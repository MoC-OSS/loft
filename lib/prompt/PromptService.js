"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptService = void 0;
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
        this.promptComputers.set(name, promptComputer);
    }
    async syncPrompts() {
        const prompts = await this.s3.getPrompts();
        await this.promptStorage.syncPrompts(prompts);
    }
    async computePrompt(promptName, context) {
        const promptComputer = this.promptComputers.get(promptName);
        const prompt = await this.promptStorage.getPromptByName(promptName);
        if (!prompt) {
            throw new Error(`Prompt with name "${promptName}" does not exist. Please upload Prompts with model presets to AWS S3 for sync to Redis and restart the App.`);
        }
        if (prompt && promptComputer) {
            return promptComputer(prompt, context);
        }
        return prompt;
    }
}
exports.PromptService = PromptService;
