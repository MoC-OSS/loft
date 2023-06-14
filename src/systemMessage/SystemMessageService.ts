import {
  InputContext,
  SystemMessageComputer,
  SystemMessageComputers,
} from '../@types';
import { S3Service } from '../S3Service';
import { SystemMessageType } from '../schema/CreateChatCompletionRequestSchema';
import { SystemMessageStorage } from './SystemMessageStorage';

export class SystemMessageService {
  private systemMessageComputers: SystemMessageComputers = new Map();

  constructor(
    private readonly systemMessageStorage: SystemMessageStorage,
    private readonly s3: S3Service,
  ) {
    this.systemMessageStorage = systemMessageStorage;
  }

  use(name: string, systemMessageComputer: SystemMessageComputer) {
    if (this.systemMessageComputers.has(name)) {
      throw new Error(
        `A systemMessage computer with the name "${name}" already exists.`,
      );
    }
    this.systemMessageComputers.set(name, systemMessageComputer);
  }

  async syncSystemMessages(): Promise<void> {
    // get SystemMessages object from S3
    const systemMessages = await this.s3.getSystemMessages();
    // sync SystemMessages to redis
    await this.systemMessageStorage.syncSystemMessages(systemMessages);
  }

  async computeSystemMessage(
    systemMessageName: string,
    context: InputContext,
  ): Promise<SystemMessageType> {
    const systemMessageComputer =
      this.systemMessageComputers.get(systemMessageName);
    const systemMessage =
      await this.systemMessageStorage.getSystemMessageByName(systemMessageName);
    if (!systemMessage) {
      throw new Error(
        `SystemMessage with name "${systemMessageName}" does not exist. Please upload SystemMessages with model presets to AWS S3 for sync to Redis and restart the App.`,
      );
    }

    if (systemMessage && systemMessageComputer) {
      return systemMessageComputer(systemMessage, context);
    }

    return systemMessage;
  }
}
