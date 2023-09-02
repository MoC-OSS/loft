import { PromptComputer, PromptComputers, SessionProps } from '../@types';
import { PromptType } from '../schema/PromptSchema';
import { PromptStorage } from './PromptStorage';
import { getLogger } from './../Logger';
import { IStorageService } from '../memory/CloudObjectStorage';
import { Session } from '../session/Session';

const l = getLogger('PromptService');

export class PromptService {
  private promptComputers: PromptComputers = new Map();

  constructor(
    private readonly promptStorage: PromptStorage,
    private readonly s3: IStorageService,
  ) {}

  use(name: string, promptComputer: PromptComputer) {
    if (this.promptComputers.has(name)) {
      throw new Error(
        `A PromptComputer with the name "${name}" already exists.`,
      );
    }

    l.info(`Registered PromptComputer with the name "${name}".`);
    this.promptComputers.set(name, promptComputer);
  }

  async syncPrompts(): Promise<void> {
    l.info('getting prompts from S3...');
    const prompts = await this.s3.getPrompts();
    l.info('syncing prompts to redis...');
    await this.promptStorage.syncPrompts(prompts);
  }

  async computePrompt(
    promptName: string,
    session: Session,
  ): Promise<PromptType> {
    l.info(
      `sessionId: ${session.sessionId} - getting prompt: ${promptName} computer from map...`,
    );
    const promptComputer = this.promptComputers.get(promptName);
    l.info(
      `sessionId: ${session.sessionId} - getting prompt: ${promptName} from redis...`,
    );
    const prompt = await this.promptStorage.getPromptByName(promptName);
    if (!prompt) {
      throw new Error(
        `Prompt with name "${promptName}" does not exist. Please upload Prompts with model presets to AWS S3 for sync to Redis and restart the App.`,
      );
    }

    l.info(
      `sessionId: ${session.sessionId} - checking if prompt by name: ${promptName} and promptComputer exists...`,
    );
    if (prompt && promptComputer) {
      l.info(
        `sessionId: ${session.sessionId} - computing prompt: ${promptName}...`,
      );
      return promptComputer(prompt, session);
    }

    return prompt;
  }
}
