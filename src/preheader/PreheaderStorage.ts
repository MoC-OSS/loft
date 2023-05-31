import { Redis, Cluster } from 'ioredis';
import {
  CreateChatCompletionRequestType,
  PreheaderType,
} from '../schema/CreateChatCompletionRequestSchema';

export class PreheaderStorage {
  private client: Redis | Cluster;

  constructor(client: Redis | Cluster) {
    this.client = client;
  }

  public async syncPreheaders(
    data: CreateChatCompletionRequestType,
  ): Promise<void> {
    const existingNames: Set<string> = new Set();
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

  public async getPreheaderByName(name: string): Promise<PreheaderType> {
    try {
      const data = await this.client.get(name);
      const preheader = JSON.parse(data ?? '');
      return preheader ?? null;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  public async updatePreheaderByName(
    name: string,
    newPreheader: string,
  ): Promise<void> {
    await this.client.set(name, newPreheader);
  }

  public async deletePreheaderByName(name: string): Promise<void> {
    await this.client.del(name);
  }
}
