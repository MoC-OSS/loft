import { Redis, Cluster } from 'ioredis';
import {
  CreateChatCompletionRequestType,
  SystemMessageType,
} from '../schema/CreateChatCompletionRequestSchema';

export class SystemMessageStorage {
  private client: Redis | Cluster;

  constructor(client: Redis | Cluster) {
    this.client = client;
  }

  public async syncSystemMessages(
    data: CreateChatCompletionRequestType,
  ): Promise<void> {
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
  ): Promise<SystemMessageType> {
    try {
      const data = await this.client.get(name);
      const systemMessage = JSON.parse(data ?? '');
      return systemMessage ?? null;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  public async updateSystemMessageByName(
    name: string,
    newSystemMessage: string,
  ): Promise<void> {
    await this.client.set(name, newSystemMessage);
  }

  public async deleteSystemMessageByName(name: string): Promise<void> {
    await this.client.del(name);
  }
}
