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
import { sanitizeAndValidateRedisKey } from './helpers';

export class LlmOrchestrator {
  private readonly eventManager: EventManager;
  private readonly llmIOManager: LlmIOManager;
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
    this.eventManager = new EventManager(this.hs);
    this.llmIOManager = new LlmIOManager(this.hs);
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
      async (job) => this.chatCompletionBeginProcessor(job),
      {
        connection: {
          host: this.cfg.redisHost,
          port: this.cfg.redisPort,
          db: this.cfg.bullMqDb,
        },
        autorun: false,
        lockDuration: this.cfg.jobsLockDuration || 60000, // 1 minute by default
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
      async (job) => this.chatCompletionCallProcessor(job),
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
        lockDuration: this.cfg.jobsLockDuration || 60000, // 1 minute by default
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
      const jobKey = sanitizeAndValidateRedisKey(
        `app:${
          this.cfg.appName
        }:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_begin_processor:intent:processing_new_or_existing_session:session:${
          chatData.sessionId
        }:system_message:${
          chatData.systemMessageName
        }:time:${this.getTimastamp()}`,
      );
      await this.completionQueue.add(jobKey, chatData, {
        removeOnComplete: true,
        attempts: 3,
      });
    } catch (error) {
      console.log(error);
    }
  }

  async injectPromptAndSend(
    promptName: string,
    sessionId: string,
    systemMessageName: string,
    message: string,
    promptRole: ChatCompletionRequestMessageRoleEnum = 'user',
    messageRole: ChatCompletionRequestMessageRoleEnum = 'user',
  ) {
    if (!(await this.hs.isExists(sessionId, systemMessageName)))
      throw new Error("inject prompt failed: chatId doesn't exist");

    const prevSession = await this.hs.getSession(sessionId, systemMessageName);

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

    await this.hs.updateMessages(sessionId, systemMessageName, userPrompt);
    await this.hs.updateMessages(sessionId, systemMessageName, newMessage);
    const session = await this.hs.getSession(sessionId, systemMessageName);

    const jobKey = sanitizeAndValidateRedisKey(
      `app:${
        this.cfg.appName
      }:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_call_processor:intent:prompt_injection:session:${sessionId}:system_message:${systemMessageName}:time:${this.getTimastamp()}`,
    );
    await this.llmApiCallQueue.add(jobKey, { session });
  }

  /* 
  callAgain is a helper function that allows you to send a new message to the LLM instead of last message in the history
  callAgain returns a Promise<{ status: MiddlewareStatus.CALL_AGAIN, newOutputContext: null };> if successful
  returned by callAgain status: MiddlewareStatus.CALL_AGAIN will interrupt the middleware chain and handlers, after that send the new message to the LLM Queue
   */
  public async callAgain(
    sessionId: string,
    systemMessageName: string,
    message: string,
    role: ChatCompletionRequestMessageRoleEnum = 'user',
  ): Promise<{
    status?: MiddlewareStatus;
    newOutputContext: OutputContext | undefined;
  }> {
    try {
      if (!(await this.hs.isExists(sessionId, systemMessageName)))
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

      this.hs.replaceLastUserMessage(
        sessionId,
        systemMessageName,
        newMessage,
        role,
      );
      const session = await this.hs.getSession(sessionId, systemMessageName);

      const jobKey = sanitizeAndValidateRedisKey(
        `app:${
          this.cfg.appName
        }:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_call_processor:intent:call_again:session:${sessionId}:system_message:${systemMessageName}:time:${this.getTimastamp()}`,
      );
      await this.llmApiCallQueue.add(jobKey, { session });

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

  private async chatCompletionCallProcessor(
    job: Job | { data: { session: SessionData } },
  ) {
    try {
      let { session } = job.data;
      const {
        sessionId,
        systemMessageName,
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
      if (
        status === MiddlewareStatus.CALL_AGAIN ||
        status === MiddlewareStatus.STOP
      )
        return;

      const outputMessage = outputContext.llmResponse?.choices[0].message;
      if (!outputMessage)
        throw new Error('LLM API response after OutputMiddlewares is empty!');
      await this.hs.updateMessages(sessionId, systemMessageName, outputMessage);
      session = await this.hs.getSession(sessionId, systemMessageName);

      await this.eventManager.executeEventHandlers({
        ...outputContext,
        session,
      });
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  private async chatCompletionBeginProcessor(job: Job | { data: InputData }) {
    try {
      const { systemMessageName, chatId } = job.data;
      const { message: processedMessage } =
        await this.llmIOManager.executeInputMiddlewareChain(
          job.data as InputContext,
        );

      const newMessage: ChatCompletionRequestMessage = {
        role: 'user',
        content: processedMessage,
      };

      if (await this.hs.isExists(chatId, systemMessageName)) {
        await this.hs.updateMessages(chatId, systemMessageName, newMessage);
      } else {
        const { systemMessage: computedSystemMessage, modelPreset } =
          await this.sms.computeSystemMessage(systemMessageName, job.data);

        const systemMessage: ChatCompletionRequestMessage = {
          role: 'system',
          content: computedSystemMessage,
        };
        await this.hs.createSession(
          chatId,
          systemMessageName,
          modelPreset,
          systemMessage,
        );
        await this.hs.updateMessages(chatId, systemMessageName, newMessage);
      }

      const chatSession = await this.hs.getSession(chatId, systemMessageName);

      const jobKey = sanitizeAndValidateRedisKey(
        `app:${
          this.cfg.appName
        }:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_call_processor:intent:continue_chat_processing:session:${
          chatSession.sessionId
        }:system_message:${systemMessageName}:time:${this.getTimastamp()}`,
      );
      await this.llmApiCallQueue.add(
        jobKey,
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

  private getTimastamp() {
    return Math.floor(Date.now() / 1000); // unix timestamp in seconds
  }
}
