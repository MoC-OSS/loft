"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmOrchestrator = void 0;
const EventManager_1 = require("./EventManager");
const index_1 = require("./@types/index");
const bullmq_1 = require("bullmq");
const openai_1 = require("openai");
const LlmIoManager_1 = require("./LlmIoManager");
const ChatCompletionSchema_1 = require("./schema/ChatCompletionSchema");
class LlmOrchestrator {
    cfg;
    sms;
    ps;
    hs;
    eventManager = new EventManager_1.EventManager();
    llmIOManager = new LlmIoManager_1.LlmIOManager();
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
            await this.completionQueue.add(`input:process:chat:${data.chatId}`, chatData, {
                removeOnComplete: true,
                attempts: 3,
            });
        }
        catch (error) {
            console.log(error);
        }
    }
    async injectPromptAndSend(promptName, userInput) {
        const { chatId } = userInput;
        if (!(await this.hs.isExists(chatId)))
            throw new Error("inject prompt failed: chatId doesn't exist");
        const promptData = await this.ps.computePrompt(promptName, userInput);
        const userPrompt = {
            role: 'user',
            content: promptData.prompt,
        };
        this.hs.updateMessages(chatId, userPrompt);
        const processedInputContext = await this.llmIOManager.executeInputMiddlewareChain(userInput);
        const newMessage = {
            role: 'user',
            content: processedInputContext.message,
        };
        await this.hs.updateMessages(chatId, newMessage);
        const session = await this.hs.getSession(chatId);
        await this.llmApiCallQueue.add(`insert:with:prompt:llm:${chatId}`, session);
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
        try {
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
        catch (error) {
            console.log(error);
            throw error;
        }
    }
    async chatCompletionProcessor(job) {
        try {
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
        catch (error) {
            console.log(error);
            throw error;
        }
    }
}
exports.LlmOrchestrator = LlmOrchestrator;
