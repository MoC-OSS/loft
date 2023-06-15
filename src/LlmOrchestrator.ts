import { EventHandler, EventManager, defaultHandler } from './EventManager';
import {
  AsyncLLMInputMiddleware,
  AsyncLLMOutputMiddleware,
  Config,
  InputContext,
  InputData,
  MiddlewareStatus,
  SessionData,
  SystemMessageComputer,
} from './@types/index';
import { Job, Queue, Worker } from 'bullmq';
import {
  ChatCompletionRequestMessage,
  ChatCompletionResponseMessage,
  Configuration,
  OpenAIApi,
} from 'openai';
import { chatCompletionInputSchema } from './schema/chatCompletionSchema';
import { HistoryStorage } from './HistoryStorage';
import { LlmIOManager } from './LlmIoManager';
import { SystemMessageService } from './systemMessage/SystemMessageService';

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
    hs: HistoryStorage,
  ): Promise<LlmOrchestrator> {
    const instance = new LlmOrchestrator(cfg, sms, hs);
    await instance.initialize();
    return instance;
  }

  private async initialize(): Promise<void> {
    await this.sms.syncSystemMessages();
    this.completionWorker.run(); // run the worker after sync systemMessages
    this.llmApiCallWorker.run();
  }

  public async chatCompletion(data: InputData) {
    try {
      const chatData = chatCompletionInputSchema.parse(data);
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

  public async callAgain(data: {
    chatId: string;
    message: ChatCompletionResponseMessage | ChatCompletionRequestMessage;
  }) {
    const { chatId, message } = data;
    try {
      this.hs.replaceLastUserMessage(chatId, message);
      const session = await this.hs.getSession(chatId);
      await this.llmApiCallQueue.add(`input:recall:llm:${chatId}`, session);
    } catch (error) {
      console.log(error);
    }
  }

  async syncSystemMessages() {
    await this.sms.syncSystemMessages();
  }

  useComputeSystemMessage(name: string, handler: SystemMessageComputer) {
    this.sms.use(name, handler);
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
    job: Job | { data: InputData; session: SessionData },
  ) {
    const {
      data: { chatId },
      session: {
        messages,
        modelPreset: { model },
      },
    } = job.data;

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

    await this.hs.updateMessages(chatId, ccm);
    await this.eventManager.executeEventHandlers(outputContext);
  }

  private async chatCompletionProcessor(job: Job | { data: InputData }) {
    const {
      systemMessage: systemMessageName,
      message,
      chatId,
      intent,
    } = job.data;
    const processedUserMsg =
      await this.llmIOManager.executeInputMiddlewareChain(
        job.data as InputContext,
      );

    const newMessage: ChatCompletionRequestMessage = {
      role: 'user',
      content: processedUserMsg.message,
    };

    if (await this.hs.isExists(job.data.chatId)) {
      await this.hs.updateMessages(job.data.chatId, newMessage);
    } else {
      const phData = await this.sms.computeSystemMessage(
        systemMessageName,
        job.data,
      );
      const systemMessage: ChatCompletionRequestMessage = {
        role: 'system',
        content: phData.systemMessage,
      };
      await this.hs.createSession(job.data.chatId, phData.modelPreset, [
        systemMessage,
        newMessage,
      ]);
    }

    const chatSession = await this.hs.getSession(job.data.chatId);

    await this.llmApiCallQueue.add(
      `llm:call:chat:${job.data.chatId}`,
      {
        data: job.data,
        session: chatSession,
      },
      { removeOnComplete: true, attempts: 3 },
    );
  }
}
