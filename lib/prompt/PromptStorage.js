import { getLogger } from './../Logger';
const l = getLogger('PromptStorage');
export class PromptStorage {
    client;
    constructor(client) {
        this.client = client;
    }
    async syncPrompts(data) {
        l.info('syncing prompts to redis...');
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
        l.info(`getting prompt: ${name} from redis...`);
        try {
            const data = await this.client.get(name);
            if (data === null || data === undefined)
                return null;
            return JSON.parse(data ?? '');
        }
        catch (error) {
            l.error(error);
            throw error;
        }
    }
    async updatePromptByName(name, prompt) {
        l.info(`updating prompt: ${name} in redis...`);
        await this.client.set(name, prompt);
    }
    async deletePromptByName(name) {
        l.info(`deleting prompt: ${name} from redis...`);
        await this.client.del(name);
    }
}
