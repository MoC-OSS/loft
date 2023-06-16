"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptStorage = void 0;
class PromptStorage {
    client;
    constructor(client) {
        this.client = client;
    }
    async syncPrompts(data) {
        const existingNames = new Set();
        const pipeline = this.client.pipeline();
        // Iterate through the ingested Prompts and store them in Redis
        data.prompts.forEach((p) => {
            pipeline.set(p.name, JSON.stringify(p));
            existingNames.add(p.name);
        });
        // Retrieve the existing names from Redis
        const storedNames = await this.client.keys('*');
        // Find and remove the Prompts with names that are missing in the received Prompts
        storedNames.forEach((storedName) => {
            if (!existingNames.has(storedName)) {
                pipeline.del(storedName);
            }
        });
        await pipeline.exec();
    }
    async getPromptByName(name) {
        try {
            const data = await this.client.get(name);
            if (data === null || data === undefined)
                return null;
            return JSON.parse(data ?? '');
        }
        catch (error) {
            console.error(error);
            throw error;
        }
    }
    async updatePromptByName(name, prompt) {
        await this.client.set(name, prompt);
    }
    async deletePromptByName(name) {
        await this.client.del(name);
    }
}
exports.PromptStorage = PromptStorage;
