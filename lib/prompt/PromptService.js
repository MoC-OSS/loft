"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptService = void 0;
const Logger_1 = require("./../Logger");
const l = (0, Logger_1.getLogger)('PromptService');
class PromptService {
    promptStorage;
    s3;
    promptComputers = new Map();
    constructor(promptStorage, s3) {
        this.promptStorage = promptStorage;
        this.s3 = s3;
    }
    use(name, promptComputer) {
        if (this.promptComputers.has(name)) {
            throw new Error(`A PromptComputer with the name "${name}" already exists.`);
        }
        l.info(`Registered PromptComputer with the name "${name}".`);
        this.promptComputers.set(name, promptComputer);
    }
    async syncPrompts() {
        l.info('getting prompts from S3...');
        const prompts = await this.s3.getPrompts();
        l.info('syncing prompts to redis...');
        await this.promptStorage.syncPrompts(prompts);
    }
    async computePrompt(promptName, session) {
        l.info(`sessionId: ${session.sessionId} - getting prompt: ${promptName} computer from map...`);
        const promptComputer = this.promptComputers.get(promptName);
        l.info(`sessionId: ${session.sessionId} - getting prompt: ${promptName} from redis...`);
        const prompt = await this.promptStorage.getPromptByName(promptName);
        if (!prompt) {
            throw new Error(`Prompt with name "${promptName}" does not exist. Please upload Prompts with model presets to AWS S3 for sync to Redis and restart the App.`);
        }
        l.info(`sessionId: ${session.sessionId} - checking if prompt by name: ${promptName} and promptComputer exists...`);
        if (prompt && promptComputer) {
            l.info(`sessionId: ${session.sessionId} - computing prompt: ${promptName}...`);
            return promptComputer(prompt, session);
        }
        return prompt;
    }
}
exports.PromptService = PromptService;
