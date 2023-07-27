import { Redis, Cluster } from 'ioredis';
import { PromptType, PromptsFileType } from '../schema/PromptSchema';
import { getLogger } from './../Logger';

const l = getLogger('PromptStorage');

export class PromptStorage {
  private client: Redis | Cluster;

  constructor(client: Redis | Cluster) {
    this.client = client;
  }

  public async syncPrompts(data: PromptsFileType): Promise<void> {
    l.info('syncing prompts to redis...');
    const existingNames: Set<string> = new Set();
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

  public async getPromptByName(name: string): Promise<PromptType | null> {
    l.info(`getting prompt: ${name} from redis...`);
    try {
      const data = await this.client.get(name);
      if (data === null || data === undefined) return null;

      return JSON.parse(data ?? '');
    } catch (error) {
      l.error(error);
      throw error;
    }
  }

  public async updatePromptByName(name: string, prompt: string): Promise<void> {
    l.info(`updating prompt: ${name} in redis...`);
    await this.client.set(name, prompt);
  }

  public async deletePromptByName(name: string): Promise<void> {
    l.info(`deleting prompt: ${name} from redis...`);
    await this.client.del(name);
  }
}
