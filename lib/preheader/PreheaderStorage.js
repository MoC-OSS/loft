"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreheaderStorage = void 0;
class PreheaderStorage {
    client;
    constructor(client) {
        this.client = client;
    }
    async syncPreheaders(data) {
        const existingNames = new Set();
        const pipeline = this.client.pipeline();
        // Iterate through the ingested Preheaders and store them in Redis
        data.preheaders.forEach((p) => {
            pipeline.set(p.name, JSON.stringify(p));
            existingNames.add(p.name);
        });
        // Retrieve the existing names from Redis
        const storedNames = await this.client.keys('*');
        // Find and remove the preheaders with names that are missing in the received preheaders
        storedNames.forEach((storedName) => {
            if (!existingNames.has(storedName)) {
                pipeline.del(storedName);
            }
        });
        await pipeline.exec();
    }
    async getPreheaderByName(name) {
        try {
            const data = await this.client.get(name);
            const preheader = JSON.parse(data ?? '');
            return preheader ?? null;
        }
        catch (error) {
            console.error(error);
            throw error;
        }
    }
    async updatePreheaderByName(name, newPreheader) {
        await this.client.set(name, newPreheader);
    }
    async deletePreheaderByName(name) {
        await this.client.del(name);
    }
}
exports.PreheaderStorage = PreheaderStorage;
