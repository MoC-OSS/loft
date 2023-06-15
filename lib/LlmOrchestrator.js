"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmOrchestrator = void 0;
const EventManager_1 = require("./EventManager");
const index_1 = require("./@types/index");
const bullmq_1 = require("bullmq");
const openai_1 = require("openai");
const chatCompletionSchema_1 = require("./schema/chatCompletionSchema");
const LlmIoManager_1 = require("./LlmIoManager");
class LlmOrchestrator {
    cfg;
    sms;
    hs;
    eventManager = new EventManager_1.EventManager();
    llmIOManager = new LlmIoManager_1.LlmIOManager();
    openai;
    completionQueue;
    completionWorker;
    llmApiCallQueue;
    llmApiCallWorker;
    constructor(cfg, sms, hs) {
        this.cfg = cfg;
        this.sms = sms;
        this.hs = hs;
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
        this.completionWorker = new bullmq_1.Worker('chatCompletionQueue', async (job) => this.chatCompletionProcessor(job), {
            connection: {
                host: this.cfg.redisHost,
                port: this.cfg.redisPort,
                db: this.cfg.bullMqDb,
            },
            autorun: false,
        });
        this.llmApiCallQueue = new bullmq_1.Queue('llmApiCallQueue', {
            connection: {
                host: this.cfg.redisHost,
                port: this.cfg.redisPort,
                db: this.cfg.bullMqDb,
            },
        });
        this.llmApiCallWorker = new bullmq_1.Worker('llmApiCallQueue', async (job) => this.llmApiCallProcessor(job), {
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
        });
        this.completionWorker.on('error', (error) => {
            console.log(error);
        });
    }
    static async createInstance(cfg, sms, hs) {
        const instance = new LlmOrchestrator(cfg, sms, hs);
        await instance.initialize();
        return instance;
    }
    async initialize() {
        await this.sms.syncSystemMessages();
        this.completionWorker.run(); // run the worker after sync systemMessages
        this.llmApiCallWorker.run();
    }
    async chatCompletion(data) {
        try {
            const chatData = chatCompletionSchema_1.chatCompletionInputSchema.parse(data);
            await this.completionQueue.add(`input:process:chat:${data.chatId}`, chatData, {
                removeOnComplete: true,
                attempts: 3,
            });
        }
        catch (error) {
            console.log(error);
        }
    }
    async callAgain(data) {
        const { chatId, message } = data;
        try {
            this.hs.replaceLastUserMessage(chatId, message);
            const session = await this.hs.getSession(chatId);
            await this.llmApiCallQueue.add(`input:recall:llm:${chatId}`, session);
        }
        catch (error) {
            console.log(error);
        }
    }
    async syncSystemMessages() {
        await this.sms.syncSystemMessages();
    }
    useComputeSystemMessage(name, handler) {
        this.sms.use(name, handler);
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
    async llmApiCallProcessor(job) {
        const { data: { chatId }, session: { messages, modelPreset: { model }, }, } = job.data;
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
        });
        /* Cancel job and history update because in middleware was called callAgain()
         LlmOrchestrator.callAgain() will change last user message in history
         add new job to llmApiCallQueue to recall LLM API
        */
        if (status === index_1.MiddlewareStatus.CALL_AGAIN)
            return;
        await this.hs.updateMessages(chatId, ccm);
        await this.eventManager.executeEventHandlers(outputContext);
    }
    async chatCompletionProcessor(job) {
        const { systemMessage: systemMessageName, message, chatId, intent, } = job.data;
        const processedUserMsg = await this.llmIOManager.executeInputMiddlewareChain(job.data);
        const newMessage = {
            role: 'user',
            content: processedUserMsg.message,
        };
        if (await this.hs.isExists(job.data.chatId)) {
            await this.hs.updateMessages(job.data.chatId, newMessage);
        }
        else {
            const phData = await this.sms.computeSystemMessage(systemMessageName, job.data);
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
        await this.llmApiCallQueue.add(`llm:call:chat:${job.data.chatId}`, {
            data: job.data,
            session: chatSession,
        }, { removeOnComplete: true, attempts: 3 });
    }
}
exports.LlmOrchestrator = LlmOrchestrator;
