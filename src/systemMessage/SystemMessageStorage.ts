import { Redis, Cluster } from 'ioredis';
import {
  CreateChatCompletionRequestType,
  SystemMessageType,
} from '../schema/CreateChatCompletionRequestSchema';
import { getLogger } from './../Logger';

const l = getLogger('SystemMessageStorage');

export class SystemMessageStorage {
  private client: Redis | Cluster;

  constructor(client: Redis | Cluster) {
    l.info('SystemMessageStorage initialization...');
    this.client = client;
  }

  public async syncSystemMessages(
    data: CreateChatCompletionRequestType,
  ): Promise<void> {
    l.info('syncing systemMessages to redis...');
    const existingNames: Set<string> = new Set();
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

  public async getSystemMessageByName(
    name: string,
  ): Promise<SystemMessageType | null> {
    try {
      l.info(`getting systemMessage: ${name} from redis...`);

      const data = await this.client.get(name);
      if (data === null || data === undefined) return null;

      return JSON.parse(data ?? '');
    } catch (error) {
      l.error(error);
      throw error;
    }
  }

  public async updateSystemMessageByName(
    name: string,
    newSystemMessage: string,
  ): Promise<void> {
    l.info(`updating systemMessage: ${name} in redis...`);
    await this.client.set(name, newSystemMessage);
  }

  public async deleteSystemMessageByName(name: string): Promise<void> {
    l.info(`deleting systemMessage: ${name} from redis...`);
    await this.client.del(name);
  }
}
