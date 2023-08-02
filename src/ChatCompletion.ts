import { EventHandler, EventManager, DefaultHandler } from './EventManager';
import {
  AsyncLLMInputMiddleware,
  AsyncLLMOutputMiddleware,
  ChatInputPayload,
  Config,
  ErrorHandler,
  InputPayload,
  MiddlewareStatus,
  OutputContext,
  PromptComputer,
  SessionProps,
  SystemMessageComputer,
} from './@types/index';
import { Job, Queue, Worker } from 'bullmq';
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
  Configuration,
  CreateChatCompletionResponse,
  OpenAIApi,
} from 'openai';
import { SessionStorage } from './session/SessionStorage';
import { LlmIOManager } from './LlmIoManager';
import { SystemMessageService } from './systemMessage/SystemMessageService';
import { PromptService } from './prompt/PromptService';
import { ChatCompletionInputSchema } from './schema/ChatCompletionSchema';
import { getTimestamp, sanitizeAndValidateRedisKey } from './helpers';
import { Session } from './session/Session';
import { FunctionManager, OpenAiFunction } from './FunctionManager';
import { Message } from './session/Message';
import { getLogger } from './Logger';

const l = getLogger('ChatCompletion');

export enum ChatCompletionCallInitiator {
  main_flow = 'MAIN_FLOW',
  injection = 'INJECTION',
  call_again = 'CALL_AGAIN',
  set_function_result = 'SET_FUNCTION_RESULT',
}

export class ChatCompletion {
  private readonly eventManager: EventManager;
  private readonly llmIOManager: LlmIOManager;
  private readonly fnManager: FunctionManager;
  private readonly openai: OpenAIApi;

  private readonly completionQueue!: Queue;
  private readonly completionWorker!: Worker;
  private readonly llmApiCallQueue!: Queue;
  private readonly llmApiCallWorker!: Worker;

  private constructor(
    private readonly cfg: Config,
    private readonly sms: SystemMessageService,
    private readonly ps: PromptService,
    private readonly hs: SessionStorage,
    private readonly errorHandler: ErrorHandler,
  ) {
    this.eventManager = new EventManager(this.hs, this.errorHandler);
    this.llmIOManager = new LlmIOManager();
    this.fnManager = new FunctionManager();
    this.openai = new OpenAIApi(
      new Configuration({
        apiKey: cfg.openAiKey,
      }),
    );

    l.info('ChatCompletion: completionQueue initialization...');
    this.completionQueue = new Queue('chatCompletionQueue', {
      connection: {
        host: this.cfg.redisHost,
        port: this.cfg.redisPort,
        db: this.cfg.bullMqDb,
      },
    });

    l.info('ChatCompletion: completionWorker definition...');
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

    l.info('ChatCompletion: llmApiCallQueue initialization...');
    this.llmApiCallQueue = new Queue('llmApiCallQueue', {
      connection: {
        host: this.cfg.redisHost,
        port: this.cfg.redisPort,
        db: this.cfg.bullMqDb,
      },
    });

    l.info('ChatCompletion: llmApiCallWorker definition...');
    this.llmApiCallWorker = new Worker(
      'llmApiCallQueue',
      async (job: Job) => this.chatCompletionCallProcessor(job),
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

    this.completionWorker.on('error', this.errorHandler);
    this.llmApiCallWorker.on('error', this.errorHandler);
  }

  public static async createInstance(
    cfg: Config,
    sms: SystemMessageService,
    ps: PromptService,
    hs: SessionStorage,
    errorHandler: ErrorHandler,
  ): Promise<ChatCompletion> {
    l.info('Creating ChatCompletion instance...');
    const instance = new ChatCompletion(cfg, sms, ps, hs, errorHandler);
    await instance.initialize();
    return instance;
  }

  private async initialize(): Promise<void> {
    l.info('Initializing ChatCompletion instance...');
    l.info('Syncing system messages and prompts...');
    await this.syncSystemMessagesAndPrompts();
    l.info('Starting chatCompletionBeginProcessor worker...');
    this.completionWorker.run(); // run the worker after sync systemMessages
    l.info('Starting chatCompletionCallProcessor worker...');
    this.llmApiCallWorker.run();
    l.info('ChatCompletion instance initialized successfully!');
  }

  public async call(data: InputPayload) {
    try {
      l.info(
        `chatCompletion: received input with sessionId: ${data.sessionId}`,
      );
      l.info(`chatCompletion: validating input...`);
      const chatData = ChatCompletionInputSchema.parse(data);
      const message = new Message({
        role: ChatCompletionRequestMessageRoleEnum.User,
        content: chatData.message,
      });

      const chatInputPayload: ChatInputPayload = {
        sessionId: chatData.sessionId,
        systemMessageName: chatData.systemMessageName,
        messages: [message],
      };

      l.info(`chatCompletion: creating job key...`);
      const jobKey = sanitizeAndValidateRedisKey(
        `app:${
          this.cfg.appName
        }:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_begin_processor:intent:processing_new_or_existing_session:session:${
          chatData.sessionId
        }:system_message:${chatData.systemMessageName}:time:${getTimestamp()}`,
      );
      l.info(`chatCompletion: job key created: ${jobKey}`);
      l.info(`chatCompletion: adding job to queue...`);
      await this.completionQueue.add(jobKey, chatInputPayload, {
        removeOnComplete: true,
        attempts: this.cfg.jobsAttempts,
      });
    } catch (error) {
      l.error(
        `Error occurred in ChatCompletion class when calling chatCompletion method: `,
        error,
      );
    }
  }

  async injectPromptAndSend(
    promptName: string,
    session: Session,
    messages: Message[],
    promptRole: ChatCompletionRequestMessageRoleEnum = 'user',
  ) {
    const { sessionId, systemMessageName } = session;

    l.info(
      `injecting prompt: ${promptName}, sessionId: ${sessionId}, systemMessageName: ${systemMessageName}`,
    );

    if (!(await this.hs.isExists(sessionId, systemMessageName)))
      throw new Error("inject prompt failed: sessionId doesn't exist");

    const prevSession = await this.hs.getSession(sessionId, systemMessageName);

    const promptData = await this.ps.computePrompt(promptName, prevSession);
    const userPrompt = new Message({
      role: promptRole,
      content: promptData.prompt,
    });

    const processedInputContext =
      await this.llmIOManager.executeInputMiddlewareChain({
        sessionId,
        systemMessageName,
        messages,
      });

    const lastPrompt = prevSession.messages[prevSession.messages.length - 2];
    const lastUserMessage =
      prevSession.messages[prevSession.messages.length - 1];
    const ifLastPromptIsLikeCurrentPrompt =
      lastPrompt.content === promptData.prompt;
    const ifLastUserMessageIsLikeCurrentUserMessage =
      lastUserMessage.content ===
      processedInputContext.messages[processedInputContext.messages.length - 1]
        .content;
    const isHistoryDuplicate =
      ifLastPromptIsLikeCurrentPrompt &&
      ifLastUserMessageIsLikeCurrentUserMessage;

    // if last prompt and user message is the same as the current message, don't update history and return
    if (isHistoryDuplicate) {
      const error = new Error(
        `
        sessionId: ${sessionId}.
        PromptName: ${promptName}.
        History duplicate detected.
        Row will be skipped.
        Thats can be result of not expected error related to mistakes in S3 files, Prompt callbacks or other related logic.
        Method injectPromptAndSend() will be skipped. and chat flow interrupted.`,
      );
      throw error;
    }

    await this.hs.appendMessages(sessionId, systemMessageName, [
      userPrompt,
      ...processedInputContext.messages,
    ]);
    // await this.hs.appendMessages(sessionId, systemMessageName, [newMessage]);
    const newSession = await this.hs.getSession(sessionId, systemMessageName);

    const jobKey = sanitizeAndValidateRedisKey(
      `app:${
        this.cfg.appName
      }:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_call_processor:intent:injection:session:${sessionId}:system_message:${systemMessageName}:time:${getTimestamp()}`,
    );
    await this.llmApiCallQueue.add(
      jobKey,
      { session: newSession },
      { attempts: this.cfg.chatCompletionJobCallAttempts },
    );
  }

  /**
   * Use this method when you need to call LLM API again OR after error to continue chat flow.
   * AND only if last message at ChatHistory is user role
   *
   * @param sessionId
   * @param systemMessageName
   */
  async callRetry(
    sessionId: Session['sessionId'],
    systemMessageName: string,
  ): Promise<{
    status?: MiddlewareStatus;
    newOutputContext: OutputContext | undefined;
  }> {
    let session = await this.hs.getSession(sessionId, systemMessageName);

    if (
      session.messages[session.messages.length - 1].role !==
        ChatCompletionRequestMessageRoleEnum.User ||
      session.messages[session.messages.length - 1].role !==
        ChatCompletionRequestMessageRoleEnum.Function
    ) {
      throw new Error(
        `Last message in history is not "user" or "function" role,
        callRetry() is not recommended to use in this case.
        Because it can cause unexpected behavior, or corrupt the history.
        Please fix session.messages and call callRetry() again.
        Or use call() method with user message instead.`,
      );
    }

    if (session.lastError) {
      session.lastError = null;
      session = await this.hs.save(session);
    }

    const jobKey = sanitizeAndValidateRedisKey(
      `app:${
        this.cfg.appName
      }:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_call_processor:intent:call_again:session:${sessionId}:system_message:${systemMessageName}:time:${getTimestamp()}`,
    );
    await this.llmApiCallQueue.add(
      jobKey,
      { session: session },
      { attempts: this.cfg.chatCompletionJobCallAttempts },
    );

    return {
      status: MiddlewareStatus.CALL_AGAIN,
      newOutputContext: undefined,
    };
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

  useDefaultHandler(eventHandler: DefaultHandler) {
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

  useFunction(name: string, fn: OpenAiFunction) {
    this.fnManager.use(name, fn);
  }

  private async callFunction(
    chatCompletionResult: CreateChatCompletionResponse,
    ctx: OutputContext,
  ) {
    const { sessionId, systemMessageName, modelPreset } = ctx.session;

    const fnName =
      chatCompletionResult.choices[0]?.message?.function_call?.name;
    const fnArgs =
      chatCompletionResult.choices[0]?.message?.function_call?.arguments;
    if (
      fnName &&
      fnArgs &&
      modelPreset.function_call === 'auto' &&
      (modelPreset.model === 'gpt-3.5-turbo-0613' ||
        modelPreset.model === 'gpt-4-0613')
    ) {
      const fnResult = await this.fnManager.executeFunction(
        fnName,
        fnArgs,
        ctx,
      );

      const fnMessage = new Message({
        role: ChatCompletionRequestMessageRoleEnum.Function,
        content: fnResult,
        name: fnName,
      });

      await this.hs.appendMessages(sessionId, systemMessageName, [fnMessage]);
      const newSession = await this.hs.getSession(sessionId, systemMessageName);

      const jobKey = sanitizeAndValidateRedisKey(
        `app:${
          this.cfg.appName
        }:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_call_processor:intent:set_function_result:session:${sessionId}:system_message:${systemMessageName}:time:${getTimestamp()}`,
      );

      await this.llmApiCallQueue.add(
        jobKey,
        {
          session: newSession,
        },
        {
          removeOnComplete: true,
          attempts: this.cfg.chatCompletionJobCallAttempts,
        },
      );

      return true;
    }

    return false;
  }

  private getChatCompletionInitiatorName(
    redisKey: string,
  ): ChatCompletionCallInitiator {
    const segments = redisKey.split(':');
    const intentIndex = segments.indexOf('intent');
    let initiator = segments[intentIndex + 1];

    if (!initiator) throw new Error('intent is undefined');

    initiator =
      ChatCompletionCallInitiator[
        initiator as keyof typeof ChatCompletionCallInitiator
      ];

    if (!initiator) {
      throw new Error('Invalid intent');
    }

    return initiator as ChatCompletionCallInitiator;
  }

  private async chatCompletionCallProcessor(
    job: Job<{ session: SessionProps }>,
  ) {
    let session = new Session(this.hs, job.data.session);
    const { sessionId, systemMessageName, messages, modelPreset } = session;
    const logPrefix = `sessionId: ${sessionId}, systemMessageName: ${systemMessageName} -`;
    l.info(`${logPrefix} getting chat completion initiator name...`);
    let initiator = this.getChatCompletionInitiatorName(job.name);

    try {
      l.info(`${logPrefix} chat completion initiator name: ${initiator}`);

      l.info(`${logPrefix} getting chat completion LLM response...`);
      const chatCompletion = await this.openai.createChatCompletion({
        ...session.modelPreset,
        messages: session.messages.formatToOpenAi(),
      });

      const ccm = chatCompletion.data.choices[0].message; // ccm = chat completion message (response)
      if (ccm === undefined) throw new Error('LLM API response is empty');

      l.info(`${logPrefix} executing output middlewares...`);
      let [status, outputContext] =
        await this.llmIOManager.executeOutputMiddlewareChain({
          session: session,
          llmResponse: chatCompletion.data,
          initiator,
        });

      /* Cancel job and history update because in middleware was called callAgain()
       LlmOrchestrator.callAgain() will change last user message in history 
       add new job to llmApiCallQueue to recall LLM API
      */
      if (
        status === MiddlewareStatus.CALL_AGAIN ||
        status === MiddlewareStatus.STOP
      ) {
        l.info(`${logPrefix} middleware status: ${status}, job canceled.`);
        return;
      }

      // Function result will be added to history and added to queue llmApiCallQueue.
      // After that, the execution of this job will be canceled.
      if (modelPreset.function_call === 'auto') {
        l.info(
          `${logPrefix} modelPreset.function_call: auto, calling function...`,
        );
        if (await this.callFunction(chatCompletion.data, outputContext)) {
          l.info(`${logPrefix} function called, job canceled.`);
          return;
        } else l.info(`${logPrefix} function not called. Continue...`);
      }

      const llmResponse = outputContext.llmResponse?.choices[0].message;
      if (!llmResponse)
        throw new Error('LLM API response after OutputMiddlewares is empty!');

      const responseMessage = new Message({ ...llmResponse });
      await this.hs.appendMessages(sessionId, systemMessageName, [
        responseMessage,
      ]);
      session = await this.hs.getSession(sessionId, systemMessageName);

      l.info(`${logPrefix} executing event handlers...`);
      await this.eventManager.executeEventHandlers({
        ...outputContext,
        session,
        initiator,
      });
      l.info(`${logPrefix} event handlers executed successfully!`);

      await this.releaseAccToChatQueue(
        session.sessionId,
        session.systemMessageName,
      );
    } catch (error) {
      l.error(error);
      l.error(
        `${logPrefix} check attempts... jobAttempts: ${job.opts.attempts}, of ${this.cfg.chatCompletionJobCallAttempts} provided attempts`,
      );
      if (
        job.opts.attempts &&
        job.opts.attempts >= this.cfg.chatCompletionJobCallAttempts
      ) {
        session.lastError = JSON.stringify(error);
        await session.save();

        await this.errorHandler(error, { initiator, session });
      }
      throw error;
    }
  }

  releaseAccToChatQueue = async (
    sessionId: Session['sessionId'],
    systemMessageName: Session['systemMessageName'],
  ) => {
    const logPrefix = `sessionId: ${sessionId}, systemMessageName: ${systemMessageName} -`;
    const session = await this.hs.getSession(sessionId, systemMessageName);
    try {
      l.info(`${logPrefix} checking and handling messageAccumulator...`);

      if (session.messageAccumulator && session.messageAccumulator.length > 0) {
        l.info(`chatCompletion: creating job key...`);

        const jobKey = sanitizeAndValidateRedisKey(
          `app:${
            this.cfg.appName
          }:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_begin_processor:intent:processing_new_or_existing_session:session:${
            session.sessionId
          }:system_message:${session.systemMessageName}:time:${getTimestamp()}`,
        );
        l.info(`chatCompletion: job key created: ${jobKey}`);
        l.info(`chatCompletion: adding job to queue...`);

        await this.completionQueue.add(
          jobKey,
          {
            sessionId,
            systemMessageName,
            messages: session.messageAccumulator,
          },
          {
            removeOnComplete: true,
            attempts: this.cfg.jobsAttempts,
          },
        );
        l.info(`${logPrefix} job added to queue successfully!`);

        l.info(`${logPrefix} clearing messageAccumulator...`);
        session.messageAccumulator = null;
        l.info(`${logPrefix} clearing lastError...`);
        session.lastError = null;
        l.info(`${logPrefix} saving session...`);
        await session.save();
      } else {
        l.info(
          `${logPrefix} messageAccumulator is empty, set null to acc as flag that session is not processing...`,
        );
        session.messageAccumulator = null;
        session.lastError = null;
        l.info(`${logPrefix} saving session...`);
        await session.save();
      }
    } catch (error) {
      l.error(error);
      throw error;
    }
  };

  private async chatCompletionBeginProcessor(job: Job<ChatInputPayload>) {
    const { systemMessageName, sessionId } = job.data;
    const logPrefix = `sessionId: ${sessionId}, systemMessageName: ${systemMessageName} -`;
    try {
      l.info(`${logPrefix} begin processing input middlewares`);
      const { messages: processedMessages } =
        await this.llmIOManager.executeInputMiddlewareChain(
          job.data as ChatInputPayload,
        );
      l.info(`${logPrefix} end processing input middlewares`);
      l.info(`${logPrefix} checking session exists...`);
      if (await this.hs.isExists(sessionId, systemMessageName)) {
        const session = await this.hs.getSession(sessionId, systemMessageName);

        l.info(
          `${logPrefix} session exists, checking if message accumulator exists...`,
        );
        if (session.messageAccumulator !== null || session.lastError !== null) {
          l.info(
            `${logPrefix} message accumulator exists, appending messages to accumulator...`,
          );
          await this.hs.appendMessagesToAccumulator(
            sessionId,
            systemMessageName,
            processedMessages,
            session,
          );
          l.info(`${logPrefix} messages appended to accumulator`);
          if (session.lastError !== null) {
            l.error(
              `${logPrefix} session lastError exists, calling error handler...
              You must handle this error in your error handler.
              And call ChatCompletion.callRetry() to continue chat flow.
              In other case, chat flow will be interrupted.
              And all new messages will be saved to session.messageAccumulator until ChatCompletion.callRetry() will be successfully finished.
              And after that, all messages from session.messageAccumulator will be added to session.messages and chat flow will be continued.`,
            );
            await this.errorHandler(session.lastError, {
              session,
              initiator: ChatCompletionCallInitiator.main_flow,
            });
            l.info(`${logPrefix} error handler called, job finished.`);
          }

          return;
        } else {
          l.info(
            `${logPrefix} message accumulator doesn't exist, appending messages to ChatHistory and creating empty accumulator...`,
          );
          await this.hs.appendMessages(
            sessionId,
            systemMessageName,
            processedMessages,
          );
        }
      } else {
        l.info(`${logPrefix} begin computing system message...`);
        const { systemMessage: computedSystemMessage, modelPreset } =
          await this.sms.computeSystemMessage(systemMessageName, job.data);
        const systemMessage = new Message({
          role: 'system',
          content: computedSystemMessage,
        });

        await this.hs.createSession(sessionId, systemMessageName, modelPreset, [
          systemMessage,
          ...processedMessages,
        ]);
      }

      const chatSession = await this.hs.getSession(
        sessionId,
        systemMessageName,
      );

      const jobKey = sanitizeAndValidateRedisKey(
        `app:${
          this.cfg.appName
        }:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_call_processor:intent:main_flow:session:${
          chatSession.sessionId
        }:system_message:${systemMessageName}:time:${getTimestamp()}`,
      );
      await this.llmApiCallQueue.add(
        jobKey,
        {
          session: chatSession,
        },
        {
          removeOnComplete: true,
          attempts: this.cfg.chatCompletionJobCallAttempts,
        },
      );
    } catch (error) {
      l.error(error);
      l.error(
        `${logPrefix} check attempts... jobAttempts: ${job.opts.attempts}, `,
      );
      if (job.opts.attempts && job.opts.attempts >= this.cfg.jobsAttempts) {
        if (await this.hs.isExists(sessionId, systemMessageName)) {
          const session = await this.hs.getSession(
            sessionId,
            systemMessageName,
          );
          session.lastError = JSON.stringify(error);
          await session.save();
          await this.errorHandler(error, {
            session,
            initiator: ChatCompletionCallInitiator.main_flow,
          });
        } else {
          await this.errorHandler(error, {
            initiator: ChatCompletionCallInitiator.main_flow,
            sessionId: job.data.sessionId,
            systemMessageName: job.data.systemMessageName,
          });
        }
      }
      throw error;
    }
  }
}
