"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmOrchestrator = exports.ChatCompletionCallInitiator = void 0;
const EventManager_1 = require("./EventManager");
const index_1 = require("./@types/index");
const bullmq_1 = require("bullmq");
const openai_1 = require("openai");
const LlmIoManager_1 = require("./LlmIoManager");
const ChatCompletionSchema_1 = require("./schema/ChatCompletionSchema");
const helpers_1 = require("./helpers");
var ChatCompletionCallInitiator;
(function (ChatCompletionCallInitiator) {
    ChatCompletionCallInitiator["main_flow"] = "MAIN_FLOW";
    ChatCompletionCallInitiator["injection"] = "INJECTION";
    ChatCompletionCallInitiator["call_again"] = "CALL_AGAIN";
})(ChatCompletionCallInitiator || (exports.ChatCompletionCallInitiator = ChatCompletionCallInitiator = {}));
class LlmOrchestrator {
    cfg;
    sms;
    ps;
    hs;
    eventManager;
    llmIOManager;
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
        this.eventManager = new EventManager_1.EventManager(this.hs);
        this.llmIOManager = new LlmIoManager_1.LlmIOManager();
        this.openai = new openai_1.OpenAIApi(new openai_1.Configuration({
            apiKey: cfg.openAiKey,
        }));
        this.completionQueue = new bullmq_1.Queue('chatCompletionQueue', {
            connection: {
                host: this.cfg.redisHost,
                port: this.cfg.redisPort,
                db: this.cfg.bullMqDb,
            },
        });
        this.completionWorker = new bullmq_1.Worker('chatCompletionQueue', async (job) => this.chatCompletionBeginProcessor(job), {
            connection: {
                host: this.cfg.redisHost,
                port: this.cfg.redisPort,
                db: this.cfg.bullMqDb,
            },
            autorun: false,
            lockDuration: this.cfg.jobsLockDuration || 60000, // 1 minute by default
        });
        this.llmApiCallQueue = new bullmq_1.Queue('llmApiCallQueue', {
            connection: {
                host: this.cfg.redisHost,
                port: this.cfg.redisPort,
                db: this.cfg.bullMqDb,
            },
        });
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
        this.completionWorker.on('error', (error) => {
            console.log(error);
        });
    }
    static async createInstance(cfg, sms, ps, hs) {
        const instance = new LlmOrchestrator(cfg, sms, ps, hs);
        await instance.initialize();
        return instance;
    }
    async initialize() {
        await this.syncSystemMessagesAndPrompts();
        this.completionWorker.run(); // run the worker after sync systemMessages
        this.llmApiCallWorker.run();
    }
    async chatCompletion(data) {
        try {
            const chatData = ChatCompletionSchema_1.ChatCompletionInputSchema.parse(data);
            const jobKey = (0, helpers_1.sanitizeAndValidateRedisKey)(`app:${this.cfg.appName}:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_begin_processor:intent:processing_new_or_existing_session:session:${chatData.sessionId}:system_message:${chatData.systemMessageName}:time:${this.getTimastamp()}`);
            await this.completionQueue.add(jobKey, chatData, {
                removeOnComplete: true,
                attempts: this.cfg.jobsAttentions,
            });
        }
        catch (error) {
            console.log(error);
        }
    }
    async injectPromptAndSend(promptName, session, message, promptRole = 'user', messageRole = 'user') {
        const { sessionId, systemMessageName } = session;
        if (!(await this.hs.isExists(sessionId, systemMessageName)))
            throw new Error("inject prompt failed: sessionId doesn't exist");
        const prevSession = await this.hs.getSession(sessionId, systemMessageName);
        const promptData = await this.ps.computePrompt(promptName, prevSession);
        const userPrompt = {
            role: promptRole,
            content: promptData.prompt,
        };
        const processedInputContext = await this.llmIOManager.executeInputMiddlewareChain({
            sessionId,
            message,
        });
        const newMessage = {
            role: messageRole,
            content: processedInputContext.message,
        };
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
        await this.hs.updateMessages(sessionId, systemMessageName, userPrompt);
        await this.hs.updateMessages(sessionId, systemMessageName, newMessage);
        const newSession = await this.hs.getSession(sessionId, systemMessageName);
        const jobKey = (0, helpers_1.sanitizeAndValidateRedisKey)(`app:${this.cfg.appName}:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_call_processor:intent:injection:session:${sessionId}:system_message:${systemMessageName}:time:${this.getTimastamp()}`);
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
                message,
            });
            const newMessage = {
                content: processedInputContext.message,
                role,
            };
            this.hs.replaceLastUserMessage(sessionId, systemMessageName, newMessage, role);
            const newSession = await this.hs.getSession(sessionId, systemMessageName);
            const jobKey = (0, helpers_1.sanitizeAndValidateRedisKey)(`app:${this.cfg.appName}:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_call_processor:intent:call_again:session:${sessionId}:system_message:${systemMessageName}:time:${this.getTimastamp()}`);
            await this.llmApiCallQueue.add(jobKey, { session: newSession }, { attempts: this.cfg.chatCompletionJobCallAttentions });
            return {
                status: index_1.MiddlewareStatus.CALL_AGAIN,
                newOutputContext: undefined,
            };
        }
        catch (error) {
            console.log(error);
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
        this.eventManager.useError(eventHandler);
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
            let { session } = job.data;
            const { sessionId, systemMessageName, messages, modelPreset: { model }, } = session;
            const chatCompletion = await this.openai.createChatCompletion({
                model,
                messages,
            });
            const ccm = chatCompletion.data.choices[0].message; // ccm = chat completion message (response)
            if (ccm === undefined)
                throw new Error('LLM API response is empty');
            const [status, outputContext] = await this.llmIOManager.executeOutputMiddlewareChain({
                session: job.data.session,
                llmResponse: chatCompletion.data,
                initiator: this.getChatCompletionInitiatorName(job.name),
            });
            /* Cancel job and history update because in middleware was called callAgain()
             LlmOrchestrator.callAgain() will change last user message in history
             add new job to llmApiCallQueue to recall LLM API
            */
            if (status === index_1.MiddlewareStatus.CALL_AGAIN ||
                status === index_1.MiddlewareStatus.STOP)
                return;
            const outputMessage = outputContext.llmResponse?.choices[0].message;
            if (!outputMessage)
                throw new Error('LLM API response after OutputMiddlewares is empty!');
            await this.hs.updateMessages(sessionId, systemMessageName, outputMessage);
            session = await this.hs.getSession(sessionId, systemMessageName);
            let initiator = this.getChatCompletionInitiatorName(job.name);
            await this.eventManager.executeEventHandlers({
                ...outputContext,
                session,
                initiator,
            });
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }
    async chatCompletionBeginProcessor(job) {
        try {
            const { systemMessageName, sessionId } = job.data;
            const { message: processedMessage } = await this.llmIOManager.executeInputMiddlewareChain(job.data);
            const newMessage = {
                role: 'user',
                content: processedMessage,
            };
            if (await this.hs.isExists(sessionId, systemMessageName)) {
                await this.hs.updateMessages(sessionId, systemMessageName, newMessage);
            }
            else {
                const { systemMessage: computedSystemMessage, modelPreset } = await this.sms.computeSystemMessage(systemMessageName, job.data);
                const systemMessage = {
                    role: 'system',
                    content: computedSystemMessage,
                };
                await this.hs.createSession(sessionId, systemMessageName, modelPreset, systemMessage);
                await this.hs.updateMessages(sessionId, systemMessageName, newMessage);
            }
            const chatSession = await this.hs.getSession(sessionId, systemMessageName);
            const jobKey = (0, helpers_1.sanitizeAndValidateRedisKey)(`app:${this.cfg.appName}:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_call_processor:intent:main_flow:session:${chatSession.sessionId}:system_message:${systemMessageName}:time:${this.getTimastamp()}`);
            await this.llmApiCallQueue.add(jobKey, {
                session: chatSession,
            }, {
                removeOnComplete: true,
                attempts: this.cfg.chatCompletionJobCallAttentions,
            });
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }
    getTimastamp() {
        return Math.floor(Date.now() / 1000); // unix timestamp in seconds
    }
}
exports.LlmOrchestrator = LlmOrchestrator;
