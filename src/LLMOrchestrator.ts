import { EventHandler, EventManager, defaultHandler } from './EventManager';
import { Redis } from 'ioredis';
import {
  AsyncLLMMiddleware,
  Config,
  InputData,
  SystemMessageComputer,
} from './@types/index';
import { Job, Queue, Worker } from 'bullmq';
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai';
import { chatCompletionInputSchema } from './schema/chatCompletionSchema';
import { HistoryStorage } from './HistoryStorage';
import { LlmIOManager } from './LlmIoManager';

import { S3Service } from './S3Service';
import { SystemMessageService } from './systemMessage/SystemMessageService';
import { SystemMessageStorage } from './systemMessage/SystemMessageStorage';

export class LlmOrchestrator {
  private readonly hs: HistoryStorage;
  private readonly ps: SystemMessageService;
  private readonly eventManager: EventManager = new EventManager();
  private readonly llmIOManager: LlmIOManager = new LlmIOManager();
  private readonly openai: OpenAIApi;

  private readonly completionQueue!: Queue;
  private readonly completionWorker!: Worker;

  private constructor(private readonly cfg: Config) {
    const openAIApiConfig = new Configuration({
      apiKey: cfg.openAiKey,
    });
    this.openai = new OpenAIApi(openAIApiConfig);

    const systemMessageClient = new Redis({
      host: cfg.redisHost,
      port: cfg.redisPort,
      db: cfg.systemMessageDb,
    });
    const systemMessageStorage = new SystemMessageStorage(systemMessageClient);
    const s3 = new S3Service(
      cfg.nodeEnv,
      cfg.awsRegion,
      cfg.s3BucketName,
      cfg.botName,
    );
    this.ps = new SystemMessageService(systemMessageStorage, s3);

    const historyClient = new Redis({
      host: cfg.redisHost,
      port: cfg.redisPort,
      db: cfg.historyDb,
    });
    this.hs = new HistoryStorage(historyClient, 24 * 60 * 60);

    this.completionQueue = new Queue('chatCompletionQueue', {
      connection: {
        host: cfg.redisHost,
        port: cfg.redisPort,
        db: cfg.bullMqDb,
      },
    });

    this.completionWorker = new Worker(
      'chatCompletionQueue',
      async (job) => this.chatCompletionProcessor(job),
      {
        limiter: {
          max: 1,
          duration: 1000,
        },
        concurrency: 1,
        connection: {
          host: cfg.redisHost,
          port: cfg.redisPort,
          db: cfg.bullMqDb,
        },
        autorun: false,
      },
    );

    this.completionWorker.on('error', (error) => {
      console.log(error);
    });
  }

  public static async createInstance(cfg: Config): Promise<LlmOrchestrator> {
    const instance = new LlmOrchestrator(cfg);
    await instance.initialize();
    return instance;
  }

  private async initialize(): Promise<void> {
    await this.ps.syncSystemMessages();
    this.completionWorker.run(); // run the worker after sync systemMessages
  }

  public async chatCompletion(data: InputData) {
    try {
      const chatData = chatCompletionInputSchema.parse(data);
      this.completionQueue.add('chatCompletionInput', chatData, {
        removeOnComplete: true,
        attempts: 3,
      });

      return;
    } catch (error) {
      console.log(error);
    }
  }

  async syncSystemMessages() {
    await this.ps.syncSystemMessages();
  }

  useComputeSystemMessage(name: string, handler: SystemMessageComputer) {
    this.ps.use(name, handler);
  }

  useDefaultHandler(eventHandler: defaultHandler) {
    this.eventManager.useDefault(eventHandler);
  }

  useEventHandler(name: string, eventHandler: EventHandler) {
    this.eventManager.use(name, eventHandler);
  }

  useLLMInput(name: string, middleware: AsyncLLMMiddleware) {
    this.llmIOManager.useInput(name, middleware);
  }

  useLLMOutput(name: string, middleware: AsyncLLMMiddleware) {
    this.llmIOManager.useOutput(name, middleware);
  }

  private async chatCompletionProcessor(job: Job | { data: InputData }) {
    const { systemMessageName, message, chatId, intent } = job.data;
    console.log(`chatCompletionProcessor: ${chatId} ${message}`);

    const processedUserMsg =
      await this.llmIOManager.executeInputMiddlewareChain(message);

    const newMessage: ChatCompletionRequestMessage = {
      role: 'user',
      content: processedUserMsg,
    };

    if (await this.hs.isExists(job.data.chatId)) {
      await this.hs.updateMessages(job.data.chatId, newMessage);
    } else {
      const phData = await this.ps.computeSystemMessage(systemMessageName);
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

    const chatCompletion = await this.openai.createChatCompletion({
      model: chatSession.modelPreset.model,
      messages: chatSession.messages,
    });
    const ccm = chatCompletion.data.choices[0].message; // ccm = chat completion message (response)

    let llmResponse = ccm?.content || '';
    llmResponse = await this.llmIOManager.executeOutputMiddlewareChain(
      llmResponse,
    );

    if (ccm) {
      await this.hs.updateMessages(job.data.chatId, ccm);
      this.eventManager.executeEventHandlers(llmResponse);
    } else console.error('LLM API response is empty');
  }
}
