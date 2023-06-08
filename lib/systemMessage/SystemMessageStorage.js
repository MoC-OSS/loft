"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemMessageStorage = void 0;
class SystemMessageStorage {
    client;
    constructor(client) {
        this.client = client;
    }
    async syncSystemMessages(data) {
        const existingNames = new Set();
        const pipeline = this.client.pipeline();
        // Iterate through the ingested SystemMessages and store them in Redis
        data.systemMessages.forEach((p) => {
            pipeline.set(p.name, JSON.stringify(p));
            existingNames.add(p.name);
        });
        // Retrieve the existing names from Redis
        const storedNames = await this.client.keys('*');
        // Find and remove the SystemMessages with names that are missing in the received SystemMessages
        storedNames.forEach((storedName) => {
            if (!existingNames.has(storedName)) {
                pipeline.del(storedName);
            }
        });
        await pipeline.exec();
    }
    async getSystemMessageByName(name) {
        try {
            const data = await this.client.get(name);
            const systemMessage = JSON.parse(data ?? '');
            return systemMessage ?? null;
        }
        catch (error) {
            console.error(error);
            throw error;
        }
    }
    async updateSystemMessageByName(name, newSystemMessage) {
        await this.client.set(name, newSystemMessage);
    }
    async deleteSystemMessageByName(name) {
        await this.client.del(name);
    }
}
exports.SystemMessageStorage = SystemMessageStorage;
