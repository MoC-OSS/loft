"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmOrchestrator = void 0;
const EventManager_1 = require("./EventManager");
const ioredis_1 = require("ioredis");
const bullmq_1 = require("bullmq");
const openai_1 = require("openai");
const chatCompletionSchema_1 = require("./schema/chatCompletionSchema");
const HistoryStorage_1 = require("./HistoryStorage");
const LlmIoManager_1 = require("./LlmIoManager");
const S3Service_1 = require("./S3Service");
const SystemMessageService_1 = require("./systemMessage/SystemMessageService");
const SystemMessageStorage_1 = require("./systemMessage/SystemMessageStorage");
class LlmOrchestrator {
    cfg;
    hs;
    ps;
    eventManager = new EventManager_1.EventManager();
    llmIOManager = new LlmIoManager_1.LlmIOManager();
    openai;
    completionQueue;
    completionWorker;
    constructor(cfg) {
        this.cfg = cfg;
        const openAIApiConfig = new openai_1.Configuration({
            apiKey: cfg.openAiKey,
        });
        this.openai = new openai_1.OpenAIApi(openAIApiConfig);
        const systemMessageClient = new ioredis_1.Redis({
            host: cfg.redisHost,
            port: cfg.redisPort,
            db: cfg.systemMessageDb,
        });
        const systemMessageStorage = new SystemMessageStorage_1.SystemMessageStorage(systemMessageClient);
        const s3 = new S3Service_1.S3Service(cfg.nodeEnv, cfg.awsRegion, cfg.s3BucketName, cfg.botName);
        this.ps = new SystemMessageService_1.SystemMessageService(systemMessageStorage, s3);
        const historyClient = new ioredis_1.Redis({
            host: cfg.redisHost,
            port: cfg.redisPort,
            db: cfg.historyDb,
        });
        this.hs = new HistoryStorage_1.HistoryStorage(historyClient, 24 * 60 * 60);
        this.completionQueue = new bullmq_1.Queue('chatCompletionQueue', {
            connection: {
                host: cfg.redisHost,
                port: cfg.redisPort,
                db: cfg.bullMqDb,
            },
        });
        this.completionWorker = new bullmq_1.Worker('chatCompletionQueue', async (job) => this.chatCompletionProcessor(job), {
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
        });
        this.completionWorker.on('error', (error) => {
            console.log(error);
        });
    }
    static async createInstance(cfg) {
        const instance = new LlmOrchestrator(cfg);
        await instance.initialize();
        return instance;
    }
    async initialize() {
        await this.ps.syncSystemMessages();
        this.completionWorker.run(); // run the worker after sync systemMessages
    }
    async chatCompletion(data) {
        try {
            const chatData = chatCompletionSchema_1.chatCompletionInputSchema.parse(data);
            this.completionQueue.add('chatCompletionInput', chatData, {
                removeOnComplete: true,
                attempts: 3,
            });
            return;
        }
        catch (error) {
            console.log(error);
        }
    }
    async syncSystemMessages() {
        await this.ps.syncSystemMessages();
    }
    useComputeSystemMessage(name, handler) {
        this.ps.use(name, handler);
    }
    useDefaultHandler(eventHandler) {
        this.eventManager.useDefault(eventHandler);
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
    async chatCompletionProcessor(job) {
        const { systemMessageName, message, chatId, intent } = job.data;
        console.log(`chatCompletionProcessor: ${chatId} ${message}`);
        const processedUserMsg = await this.llmIOManager.executeInputMiddlewareChain(message);
        const newMessage = {
            role: 'user',
            content: processedUserMsg,
        };
        if (await this.hs.isExists(job.data.chatId)) {
            await this.hs.updateMessages(job.data.chatId, newMessage);
        }
        else {
            const phData = await this.ps.computeSystemMessage(systemMessageName);
            const systemMessage = {
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
        llmResponse = await this.llmIOManager.executeOutputMiddlewareChain(llmResponse);
        if (ccm) {
            await this.hs.updateMessages(job.data.chatId, ccm);
            this.eventManager.executeEventHandlers(llmResponse);
        }
        else
            console.error('LLM API response is empty');
    }
}
exports.LlmOrchestrator = LlmOrchestrator;
