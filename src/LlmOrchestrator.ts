import { input } from 'zod';
import { EventHandler, EventManager, defaultHandler } from './EventManager';
import {
  AsyncLLMInputMiddleware,
  AsyncLLMOutputMiddleware,
  Config,
  InputContext,
  InputData,
  MiddlewareStatus,
  OutputContext,
  PromptComputer,
  SessionData,
  SystemMessageComputer,
} from './@types/index';
import { Job, Queue, Worker } from 'bullmq';
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
  ChatCompletionResponseMessage,
  Configuration,
  OpenAIApi,
} from 'openai';
import { HistoryStorage } from './HistoryStorage';
import { LlmIOManager } from './LlmIoManager';
import { SystemMessageService } from './systemMessage/SystemMessageService';
import { PromptService } from './prompt/PromptService';
import { ChatCompletionInputSchema } from './schema/ChatCompletionSchema';

export class LlmOrchestrator {
  private readonly eventManager: EventManager = new EventManager();
  private readonly llmIOManager: LlmIOManager = new LlmIOManager();
  private readonly openai: OpenAIApi;

  private readonly completionQueue!: Queue;
  private readonly completionWorker!: Worker;
  private readonly llmApiCallQueue!: Queue;
  private readonly llmApiCallWorker!: Worker;

  private constructor(
    private readonly cfg: Config,
    private readonly sms: SystemMessageService,
    private readonly ps: PromptService,
    private readonly hs: HistoryStorage,
  ) {
    this.openai = new OpenAIApi(
      new Configuration({
        apiKey: cfg.openAiKey,
      }),
    );

    this.completionQueue = new Queue('chatCompletionQueue', {
      connection: {
        host: this.cfg.redisHost,
        port: this.cfg.redisPort,
        db: this.cfg.bullMqDb,
      },
    });

    this.completionWorker = new Worker(
      'chatCompletionQueue',
      async (job) => this.chatCompletionProcessor(job),
      {
        connection: {
          host: this.cfg.redisHost,
          port: this.cfg.redisPort,
          db: this.cfg.bullMqDb,
        },
        autorun: false,
      },
    );

    this.llmApiCallQueue = new Queue('llmApiCallQueue', {
      connection: {
        host: this.cfg.redisHost,
        port: this.cfg.redisPort,
        db: this.cfg.bullMqDb,
      },
    });

    this.llmApiCallWorker = new Worker(
      'llmApiCallQueue',
      async (job) => this.llmApiCallProcessor(job),
      {
        limiter: {
          max: this.cfg.openAiRateLimiter.max,
          duration: this.cfg.openAiRateLimiter.duration,
        },
        concurrency: this.cfg.openAiRateLimiter.concurrency,
        connection: {
          host: this.cfg.redisHost,
          port: this.cfg.redisPort,
          db: this.cfg.bullMqDb,
        },
        autorun: false,
      },
    );

    this.completionWorker.on('error', (error) => {
      console.log(error);
    });
  }

  public static async createInstance(
    cfg: Config,
    sms: SystemMessageService,
    ps: PromptService,
    hs: HistoryStorage,
  ): Promise<LlmOrchestrator> {
    const instance = new LlmOrchestrator(cfg, sms, ps, hs);
    await instance.initialize();
    return instance;
  }

  private async initialize(): Promise<void> {
    await this.syncSystemMessagesAndPrompts();
    this.completionWorker.run(); // run the worker after sync systemMessages
    this.llmApiCallWorker.run();
  }

  public async chatCompletion(data: InputData) {
    try {
      const chatData = ChatCompletionInputSchema.parse(data);
      await this.completionQueue.add(
        `input:process:chat:${data.chatId}`,
        chatData,
        {
          removeOnComplete: true,
          attempts: 3,
        },
      );
    } catch (error) {
      console.log(error);
    }
  }

  async injectPromptAndSend(
    promptName: string,
    sessionId: string,
    message: string,
    promptRole: ChatCompletionRequestMessageRoleEnum = 'user',
    messageRole: ChatCompletionRequestMessageRoleEnum = 'user',
  ) {
    if (!(await this.hs.isExists(sessionId)))
      throw new Error("inject prompt failed: chatId doesn't exist");

    const prevSession = await this.hs.getSession(sessionId);

    const promptData = await this.ps.computePrompt(promptName, prevSession);
    const userPrompt: ChatCompletionRequestMessage = {
      role: promptRole,
      content: promptData.prompt,
    };

    const processedInputContext =
      await this.llmIOManager.executeInputMiddlewareChain({
        sessionId,
        message,
      });
    const newMessage: ChatCompletionRequestMessage = {
      role: messageRole,
      content: processedInputContext.message,
    };

    const lastPrompt = prevSession.messages[prevSession.messages.length - 2];
    const lastUserMessage =
      prevSession.messages[prevSession.messages.length - 1];
    const ifLastPromptIsLikeCurrentPrompt =
      lastPrompt.content === promptData.prompt;
    const ifLastUserMessageIsLikeCurrentUserMessage =
      lastUserMessage.content === processedInputContext.message;
    const isHistoryDuplicate =
      ifLastPromptIsLikeCurrentPrompt &&
      ifLastUserMessageIsLikeCurrentUserMessage;

    // if last prompt and user message is the same as the current message, don't update history and return
    if (isHistoryDuplicate) {
      const error = new Error(
        `
        ChatId: ${sessionId}.
        PromptName: ${promptName}.
        History duplicate detected.
        Row will be skipped.
        Thats can be result of not expected error related to mistakes in S3 files, Prompt callbacks or other related logic.
        Method injectPromptAndSend() will be skipped. and chat flow interrupted.`,
      );
      throw error;
    }

    await this.hs.updateMessages(sessionId, userPrompt);
    await this.hs.updateMessages(sessionId, newMessage);
    const session = await this.hs.getSession(sessionId);

    await this.llmApiCallQueue.add(`insert:with:prompt:llm:${sessionId}`, {
      session,
    });
  }

  /* 
  callAgain is a helper function that allows you to send a new message to the LLM instead of last message in the history
  callAgain returns a Promise<{ status: MiddlewareStatus.CALL_AGAIN, newOutputContext: null };> if successful
  returned by callAgain status: MiddlewareStatus.CALL_AGAIN will interrupt the middleware chain and handlers, after that send the new message to the LLM Queue
   */
  public async callAgain(
    sessionId: string,
    message: string,
    role: ChatCompletionRequestMessageRoleEnum = 'user',
  ): Promise<{
    status?: MiddlewareStatus;
    newOutputContext: OutputContext | undefined;
  }> {
    try {
      if (!(await this.hs.isExists(sessionId)))
        throw new Error("inject prompt failed: chatId doesn't exist");

      const processedInputContext =
        await this.llmIOManager.executeInputMiddlewareChain({
          sessionId,
          message,
        });

      const newMessage: ChatCompletionRequestMessage = {
        content: processedInputContext.message,
        role,
      };

      this.hs.replaceLastUserMessage(sessionId, newMessage, role);
      const session = await this.hs.getSession(sessionId);
      await this.llmApiCallQueue.add(`input:recall:llm:${sessionId}`, {
        session,
      });

      return {
        status: MiddlewareStatus.CALL_AGAIN,
        newOutputContext: undefined,
      };
    } catch (error) {
      console.log(error);

      return {
        status: MiddlewareStatus.STOP,
        newOutputContext: undefined,
      };
    }
  }

  async deleteSessionsById(sessionId: string) {
    await this.hs.deleteSessionsById(sessionId);
  }

  async syncSystemMessagesAndPrompts() {
    await this.sms.syncSystemMessages();
    await this.ps.syncPrompts();
  }

  useComputeSystemMessage(name: string, handler: SystemMessageComputer) {
    this.sms.use(name, handler);
  }

  useComputePrompt(name: string, handler: PromptComputer) {
    this.ps.use(name, handler);
  }

  useDefaultHandler(eventHandler: defaultHandler) {
    this.eventManager.useDefault(eventHandler);
  }

  useEventHandler(name: string, eventHandler: EventHandler) {
    this.eventManager.use(name, eventHandler);
  }

  useLLMInput(name: string, middleware: AsyncLLMInputMiddleware) {
    this.llmIOManager.useInput(name, middleware);
  }

  useLLMOutput(name: string, middleware: AsyncLLMOutputMiddleware) {
    this.llmIOManager.useOutput(name, middleware);
  }

  private async llmApiCallProcessor(
    job: Job | { data: { session: SessionData } },
  ) {
    try {
      let { session } = job.data;
      const {
        sessionId,
        messages,
        modelPreset: { model },
      } = session;

      const chatCompletion = await this.openai.createChatCompletion({
        model,
        messages,
      });

      const ccm = chatCompletion.data.choices[0].message; // ccm = chat completion message (response)
      if (ccm === undefined) throw new Error('LLM API response is empty');

      const [status, outputContext] =
        await this.llmIOManager.executeOutputMiddlewareChain({
          session: job.data.session,
          llmResponse: chatCompletion.data,
        });

      /* Cancel job and history update because in middleware was called callAgain()
       LlmOrchestrator.callAgain() will change last user message in history 
       add new job to llmApiCallQueue to recall LLM API
      */
      if (status === MiddlewareStatus.CALL_AGAIN) return;

      const outputMessage = outputContext.llmResponse?.choices[0].message;
      if (!outputMessage)
        throw new Error('LLM API response after OutputMiddlewares is empty!');
      await this.hs.updateMessages(sessionId, outputMessage);
      session = await this.hs.getSession(sessionId);

      await this.eventManager.executeEventHandlers({
        ...outputContext,
        session,
      });
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  private async chatCompletionProcessor(job: Job | { data: InputData }) {
    try {
      const { systemMessage: systemMessageName, chatId } = job.data;
      const { message: processedMessage } =
        await this.llmIOManager.executeInputMiddlewareChain(
          job.data as InputContext,
        );

      const newMessage: ChatCompletionRequestMessage = {
        role: 'user',
        content: processedMessage,
      };

      if (await this.hs.isExists(chatId)) {
        await this.hs.updateMessages(chatId, newMessage);
      } else {
        const { systemMessage: computedSystemMessage, modelPreset } =
          await this.sms.computeSystemMessage(systemMessageName, job.data);

        const systemMessage: ChatCompletionRequestMessage = {
          role: 'system',
          content: computedSystemMessage,
        };
        await this.hs.createSession(chatId, modelPreset, [
          systemMessage,
          newMessage,
        ]);
      }

      const chatSession = await this.hs.getSession(chatId);

      await this.llmApiCallQueue.add(
        `llm:call:chat:${chatId}`,
        {
          session: chatSession,
        },
        { removeOnComplete: true, attempts: 3 },
      );
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
