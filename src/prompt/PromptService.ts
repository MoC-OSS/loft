import {
  InputContext,
  PromptComputer,
  PromptComputers,
  SessionData,
} from '../@types';
import { S3Service } from '../S3Service';
import { PromptType } from '../schema/PromptSchema';
import { PromptStorage } from './PromptStorage';

export class PromptService {
  private promptComputers: PromptComputers = new Map();

  constructor(
    private readonly promptStorage: PromptStorage,
    private readonly s3: S3Service,
  ) {}

  use(name: string, promptComputer: PromptComputer) {
    if (this.promptComputers.has(name)) {
      throw new Error(
        `A PromptComputer with the name "${name}" already exists.`,
      );
    }
    this.promptComputers.set(name, promptComputer);
  }

  async syncPrompts(): Promise<void> {
    const prompts = await this.s3.getPrompts();
    await this.promptStorage.syncPrompts(prompts);
  }

  async computePrompt(
    promptName: string,
    session: SessionData,
  ): Promise<PromptType> {
    const promptComputer = this.promptComputers.get(promptName);
    const prompt = await this.promptStorage.getPromptByName(promptName);
    if (!prompt) {
      throw new Error(
        `Prompt with name "${promptName}" does not exist. Please upload Prompts with model presets to AWS S3 for sync to Redis and restart the App.`,
      );
    }

    if (prompt && promptComputer) {
      return promptComputer(prompt, session);
    }

    return prompt;
  }
}
