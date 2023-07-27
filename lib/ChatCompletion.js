"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatCompletion = exports.ChatCompletionCallInitiator = void 0;
const EventManager_1 = require("./EventManager");
const index_1 = require("./@types/index");
const bullmq_1 = require("bullmq");
const openai_1 = require("openai");
const LlmIoManager_1 = require("./LlmIoManager");
const ChatCompletionSchema_1 = require("./schema/ChatCompletionSchema");
const helpers_1 = require("./helpers");
const Session_1 = require("./session/Session");
const FunctionManager_1 = require("./FunctionManager");
const Message_1 = require("./session/Message");
const Logger_1 = require("./Logger");
const l = (0, Logger_1.getLogger)('ChatCompletion');
var ChatCompletionCallInitiator;
(function (ChatCompletionCallInitiator) {
    ChatCompletionCallInitiator["main_flow"] = "MAIN_FLOW";
    ChatCompletionCallInitiator["injection"] = "INJECTION";
    ChatCompletionCallInitiator["call_again"] = "CALL_AGAIN";
    ChatCompletionCallInitiator["set_function_result"] = "SET_FUNCTION_RESULT";
})(ChatCompletionCallInitiator || (exports.ChatCompletionCallInitiator = ChatCompletionCallInitiator = {}));
class ChatCompletion {
    cfg;
    sms;
    ps;
    hs;
    eventManager;
    llmIOManager;
    fnManager;
    errorHandler;
    openai;
    completionQueue;
    completionWorker;
    llmApiCallQueue;
    llmApiCallWorker;
    constructor(cfg, sms, ps, hs) {
        this.cfg = cfg;
        this.sms = sms;
        this.ps = ps;
        this.hs = hs;
        this.errorHandler = async () => {
            l.error('Error occurred in ChatCompletion class, but no ErrorHandler defined. Please define using useErrorHandler(err): Promise<void> to receive the error and session data.');
        };
        this.eventManager = new EventManager_1.EventManager(this.hs, this.errorHandler);
        this.llmIOManager = new LlmIoManager_1.LlmIOManager();
        this.fnManager = new FunctionManager_1.FunctionManager();
        this.openai = new openai_1.OpenAIApi(new openai_1.Configuration({
            apiKey: cfg.openAiKey,
        }));
        l.info('ChatCompletion: completionQueue initialization...');
        this.completionQueue = new bullmq_1.Queue('chatCompletionQueue', {
            connection: {
                host: this.cfg.redisHost,
                port: this.cfg.redisPort,
                db: this.cfg.bullMqDb,
            },
        });
        l.info('ChatCompletion: completionWorker definition...');
        this.completionWorker = new bullmq_1.Worker('chatCompletionQueue', async (job) => this.chatCompletionBeginProcessor(job), {
            connection: {
                host: this.cfg.redisHost,
                port: this.cfg.redisPort,
                db: this.cfg.bullMqDb,
            },
            autorun: false,
            lockDuration: this.cfg.jobsLockDuration || 60000, // 1 minute by default
        });
        l.info('ChatCompletion: llmApiCallQueue initialization...');
        this.llmApiCallQueue = new bullmq_1.Queue('llmApiCallQueue', {
            connection: {
                host: this.cfg.redisHost,
                port: this.cfg.redisPort,
                db: this.cfg.bullMqDb,
            },
        });
        l.info('ChatCompletion: llmApiCallWorker definition...');
        this.llmApiCallWorker = new bullmq_1.Worker('llmApiCallQueue', async (job) => this.chatCompletionCallProcessor(job), {
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
        });
        this.completionWorker.on('error', this.errorHandler);
        this.llmApiCallWorker.on('error', this.errorHandler);
    }
    static async createInstance(cfg, sms, ps, hs) {
        l.info('Creating ChatCompletion instance...');
        const instance = new ChatCompletion(cfg, sms, ps, hs);
        await instance.initialize();
        return instance;
    }
    async initialize() {
        l.info('Initializing ChatCompletion instance...');
        l.info('Syncing system messages and prompts...');
        await this.syncSystemMessagesAndPrompts();
        l.info('Starting chatCompletionBeginProcessor worker...');
        this.completionWorker.run(); // run the worker after sync systemMessages
        l.info('Starting chatCompletionCallProcessor worker...');
        this.llmApiCallWorker.run();
        l.info('ChatCompletion instance initialized successfully!');
    }
    async chatCompletion(data) {
        try {
            l.info(`chatCompletion: received input with sessionId: ${data.sessionId}`);
            l.info(`chatCompletion: validating input...`);
            const chatData = ChatCompletionSchema_1.ChatCompletionInputSchema.parse(data);
            l.info(`chatCompletion: creating job key...`);
            const jobKey = (0, helpers_1.sanitizeAndValidateRedisKey)(`app:${this.cfg.appName}:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_begin_processor:intent:processing_new_or_existing_session:session:${chatData.sessionId}:system_message:${chatData.systemMessageName}:time:${(0, helpers_1.getTimestamp)()}`);
            l.info(`chatCompletion: job key created: ${jobKey}`);
            l.info(`chatCompletion: adding job to queue...`);
            await this.completionQueue.add(jobKey, chatData, {
                removeOnComplete: true,
                attempts: this.cfg.jobsAttentions,
            });
        }
        catch (error) {
            l.error(`Error occurred in ChatCompletion class when calling chatCompletion method: `, error);
        }
    }
    async injectPromptAndSend(promptName, session, message, promptRole = 'user', messageRole = 'user') {
        const { sessionId, systemMessageName } = session;
        l.info(`injecting prompt: ${promptName}, sessionId: ${sessionId}, systemMessageName: ${systemMessageName}`);
        if (!(await this.hs.isExists(sessionId, systemMessageName)))
            throw new Error("inject prompt failed: sessionId doesn't exist");
        const prevSession = await this.hs.getSession(sessionId, systemMessageName);
        const promptData = await this.ps.computePrompt(promptName, prevSession);
        const userPrompt = new Message_1.Message({
            role: promptRole,
            content: promptData.prompt,
        });
        const processedInputContext = await this.llmIOManager.executeInputMiddlewareChain({
            sessionId,
            systemMessageName,
            message,
        });
        const newMessage = new Message_1.Message({
            role: messageRole,
            content: processedInputContext.message,
        });
        const lastPrompt = prevSession.messages[prevSession.messages.length - 2];
        const lastUserMessage = prevSession.messages[prevSession.messages.length - 1];
        const ifLastPromptIsLikeCurrentPrompt = lastPrompt.content === promptData.prompt;
        const ifLastUserMessageIsLikeCurrentUserMessage = lastUserMessage.content === processedInputContext.message;
        const isHistoryDuplicate = ifLastPromptIsLikeCurrentPrompt &&
            ifLastUserMessageIsLikeCurrentUserMessage;
        // if last prompt and user message is the same as the current message, don't update history and return
        if (isHistoryDuplicate) {
            const error = new Error(`
        sessionId: ${sessionId}.
        PromptName: ${promptName}.
        History duplicate detected.
        Row will be skipped.
        Thats can be result of not expected error related to mistakes in S3 files, Prompt callbacks or other related logic.
        Method injectPromptAndSend() will be skipped. and chat flow interrupted.`);
            throw error;
        }
        await this.hs.appendMessages(sessionId, systemMessageName, [userPrompt]);
        await this.hs.appendMessages(sessionId, systemMessageName, [newMessage]);
        const newSession = await this.hs.getSession(sessionId, systemMessageName);
        const jobKey = (0, helpers_1.sanitizeAndValidateRedisKey)(`app:${this.cfg.appName}:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_call_processor:intent:injection:session:${sessionId}:system_message:${systemMessageName}:time:${(0, helpers_1.getTimestamp)()}`);
        await this.llmApiCallQueue.add(jobKey, { session: newSession }, { attempts: this.cfg.chatCompletionJobCallAttentions });
    }
    /*
    callAgain is a helper function that allows you to send a new message to the LLM instead of last message in the history
    callAgain returns a Promise<{ status: MiddlewareStatus.CALL_AGAIN, newOutputContext: null };> if successful
    returned by callAgain status: MiddlewareStatus.CALL_AGAIN will interrupt the middleware chain and handlers, after that send the new message to the LLM Queue
     */
    async callAgain(session, message, role = 'user') {
        try {
            const { sessionId, systemMessageName } = session;
            if (!(await this.hs.isExists(sessionId, systemMessageName)))
                throw new Error("inject prompt failed: sessionId doesn't exist");
            const processedInputContext = await this.llmIOManager.executeInputMiddlewareChain({
                sessionId,
                systemMessageName,
                message,
            });
            const newMessage = {
                content: processedInputContext.message,
                role,
            };
            this.hs.replaceLastUserMessage(sessionId, systemMessageName, newMessage, role);
            const newSession = await this.hs.getSession(sessionId, systemMessageName);
            const jobKey = (0, helpers_1.sanitizeAndValidateRedisKey)(`app:${this.cfg.appName}:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_call_processor:intent:call_again:session:${sessionId}:system_message:${systemMessageName}:time:${(0, helpers_1.getTimestamp)()}`);
            await this.llmApiCallQueue.add(jobKey, { session: newSession }, { attempts: this.cfg.chatCompletionJobCallAttentions });
            return {
                status: index_1.MiddlewareStatus.CALL_AGAIN,
                newOutputContext: undefined,
            };
        }
        catch (error) {
            l.error(error);
            return {
                status: index_1.MiddlewareStatus.STOP,
                newOutputContext: undefined,
            };
        }
    }
    async deleteSessionsById(sessionId) {
        await this.hs.deleteSessionsById(sessionId);
    }
    async syncSystemMessagesAndPrompts() {
        await this.sms.syncSystemMessages();
        await this.ps.syncPrompts();
    }
    useComputeSystemMessage(name, handler) {
        this.sms.use(name, handler);
    }
    useComputePrompt(name, handler) {
        this.ps.use(name, handler);
    }
    useDefaultHandler(eventHandler) {
        this.eventManager.useDefault(eventHandler);
    }
    useErrorHandler(eventHandler) {
        this.errorHandler = eventHandler;
    }
    useEventHandler(name, eventHandler) {
        this.eventManager.use(name, eventHandler);
    }
    useLLMInput(name, middleware) {
        this.llmIOManager.useInput(name, middleware);
    }
    useLLMOutput(name, middleware) {
        this.llmIOManager.useOutput(name, middleware);
    }
    useFunction(name, fn) {
        this.fnManager.use(name, fn);
    }
    async callFunction(chatCompletionResult, ctx) {
        const { sessionId, systemMessageName, modelPreset } = ctx.session;
        const fnName = chatCompletionResult.choices[0]?.message?.function_call?.name;
        const fnArgs = chatCompletionResult.choices[0]?.message?.function_call?.arguments;
        if (fnName &&
            fnArgs &&
            modelPreset.function_call === 'auto' &&
            (modelPreset.model === 'gpt-3.5-turbo-0613' ||
                modelPreset.model === 'gpt-4-0613')) {
            const fnResult = await this.fnManager.executeFunction(fnName, fnArgs, ctx);
            const fnMessage = new Message_1.Message({
                role: openai_1.ChatCompletionRequestMessageRoleEnum.Function,
                content: fnResult,
                name: fnName,
            });
            await this.hs.appendMessages(sessionId, systemMessageName, [fnMessage]);
            const newSession = await this.hs.getSession(sessionId, systemMessageName);
            const jobKey = (0, helpers_1.sanitizeAndValidateRedisKey)(`app:${this.cfg.appName}:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_call_processor:intent:set_function_result:session:${sessionId}:system_message:${systemMessageName}:time:${(0, helpers_1.getTimestamp)()}`);
            await this.llmApiCallQueue.add(jobKey, {
                session: newSession,
            }, {
                removeOnComplete: true,
                attempts: this.cfg.chatCompletionJobCallAttentions,
            });
            return true;
        }
        return false;
    }
    getChatCompletionInitiatorName(redisKey) {
        const segments = redisKey.split(':');
        const intentIndex = segments.indexOf('intent');
        let initiator = segments[intentIndex + 1];
        if (!initiator)
            throw new Error('intent is undefined');
        initiator =
            ChatCompletionCallInitiator[initiator];
        if (!initiator) {
            throw new Error('Invalid intent');
        }
        return initiator;
    }
    async chatCompletionCallProcessor(job) {
        try {
            let session = new Session_1.Session(this.hs, job.data.session);
            const { sessionId, systemMessageName, messages, modelPreset } = session;
            let initiator = this.getChatCompletionInitiatorName(job.name);
            const chatCompletion = await this.openai.createChatCompletion({
                ...session.modelPreset,
                messages: session.messages.formatToOpenAi(),
            });
            const ccm = chatCompletion.data.choices[0].message; // ccm = chat completion message (response)
            if (ccm === undefined)
                throw new Error('LLM API response is empty');
            let [status, outputContext] = await this.llmIOManager.executeOutputMiddlewareChain({
                session: job.data.session,
                llmResponse: chatCompletion.data,
                initiator,
            });
            /* Cancel job and history update because in middleware was called callAgain()
             LlmOrchestrator.callAgain() will change last user message in history
             add new job to llmApiCallQueue to recall LLM API
            */
            if (status === index_1.MiddlewareStatus.CALL_AGAIN ||
                status === index_1.MiddlewareStatus.STOP)
                return;
            // Function result will be added to history and added to queue llmApiCallQueue.
            // After that, the execution of this job will be canceled.
            if (modelPreset.function_call === 'auto')
                if (await this.callFunction(chatCompletion.data, outputContext))
                    return;
            const llmResponse = outputContext.llmResponse?.choices[0].message;
            if (!llmResponse)
                throw new Error('LLM API response after OutputMiddlewares is empty!');
            const responseMessage = new Message_1.Message({ ...llmResponse });
            await this.hs.appendMessages(sessionId, systemMessageName, [
                responseMessage,
            ]);
            session = await this.hs.getSession(sessionId, systemMessageName);
            await this.eventManager.executeEventHandlers({
                ...outputContext,
                session,
                initiator,
            });
        }
        catch (error) {
            l.error(error);
            throw error;
        }
    }
    async chatCompletionBeginProcessor(job) {
        try {
            const { systemMessageName, sessionId } = job.data;
            l.info(`chatCompletionBeginProcessor: begin processing input middlewares for sessionId: ${sessionId}`);
            const { message: processedMessage } = await this.llmIOManager.executeInputMiddlewareChain(job.data);
            l.info(`chatCompletionBeginProcessor: end processing input middlewares for sessionId: ${sessionId}`);
            const newMessage = new Message_1.Message({
                role: 'user',
                content: processedMessage,
            });
            if (await this.hs.isExists(sessionId, systemMessageName)) {
                await this.hs.appendMessages(sessionId, systemMessageName, [
                    newMessage,
                ]);
            }
            else {
                const { systemMessage: computedSystemMessage, modelPreset } = await this.sms.computeSystemMessage(systemMessageName, job.data);
                const systemMessage = new Message_1.Message({
                    role: 'system',
                    content: computedSystemMessage,
                });
                await this.hs.createSession(sessionId, systemMessageName, modelPreset, systemMessage);
                await this.hs.appendMessages(sessionId, systemMessageName, [
                    newMessage,
                ]);
            }
            const chatSession = await this.hs.getSession(sessionId, systemMessageName);
            const jobKey = (0, helpers_1.sanitizeAndValidateRedisKey)(`app:${this.cfg.appName}:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_call_processor:intent:main_flow:session:${chatSession.sessionId}:system_message:${systemMessageName}:time:${(0, helpers_1.getTimestamp)()}`);
            await this.llmApiCallQueue.add(jobKey, {
                session: chatSession,
            }, {
                removeOnComplete: true,
                attempts: this.cfg.chatCompletionJobCallAttentions,
            });
        }
        catch (error) {
            l.error(error);
            throw error;
        }
    }
}
exports.ChatCompletion = ChatCompletion;
