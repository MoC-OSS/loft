import { LLMPreheaderComputer, LLMPreheaderComputers } from '../@types';
import { S3Service } from '../S3Service';
import { PreheaderStorage } from './PreheaderStorage';
import { PreheaderType } from '../schema/CreateChatCompletionRequestSchema';

export class PreheaderService {
  private preheaderComputers: LLMPreheaderComputers = new Map();

  constructor(
    private readonly preheaderStorage: PreheaderStorage,
    private readonly s3: S3Service,
  ) {
    this.preheaderStorage = preheaderStorage;
  }

  use(name: string, preheaderComputer: LLMPreheaderComputer) {
    if (this.preheaderComputers.has(name)) {
      throw new Error(
        `A preheader computer with the name "${name}" already exists.`,
      );
    }
    this.preheaderComputers.set(name, preheaderComputer);
  }

  async syncPreheaders(): Promise<void> {
    // get preheaders object from S3
    const preheaders = await this.s3.getPreheaders();
    // sync preheaders to redis
    await this.preheaderStorage.syncPreheaders(preheaders);
  }

  async computePreheader(botName: string): Promise<PreheaderType> {
    const preheaderComputer = this.preheaderComputers.get(botName);
    const preheader = await this.preheaderStorage.getPreheaderByName(botName);
    if (!preheader) {
      throw new Error(
        `Preheader with name "${botName}" does not exist. Please upload Preheaders with model presets to AWS S3 for sync to Redis and restart the App.`,
      );
    }

    if (preheader && preheaderComputer) {
      return preheaderComputer(preheader);
    }

    return preheader;
  }
}
