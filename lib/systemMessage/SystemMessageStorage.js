import { getLogger } from './../Logger';
const l = getLogger('SystemMessageStorage');
export class SystemMessageStorage {
    client;
    constructor(client) {
        l.info('SystemMessageStorage initialization...');
        this.client = client;
    }
    async syncSystemMessages(data) {
        l.info('syncing systemMessages to redis...');
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
            l.info(`getting systemMessage: ${name} from redis...`);
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
    async updateSystemMessageByName(name, newSystemMessage) {
        l.info(`updating systemMessage: ${name} in redis...`);
        await this.client.set(name, newSystemMessage);
    }
    async deleteSystemMessageByName(name) {
        l.info(`deleting systemMessage: ${name} from redis...`);
        await this.client.del(name);
    }
}
