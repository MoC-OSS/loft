import {
  ChatInputPayload,
  SystemMessageComputer,
  SystemMessageComputers,
} from '../@types';
import { SystemMessageType } from '../schema/CreateChatCompletionRequestSchema';
import { SystemMessageStorage } from './SystemMessageStorage';
import { getLogger } from './../Logger';
import { IStorageService } from '../memory/CloudObjectStorage';

const l = getLogger('SystemMessageService');

export class SystemMessageService {
  private systemMessageComputers: SystemMessageComputers = new Map();

  constructor(
    private readonly systemMessageStorage: SystemMessageStorage,
    private readonly s3: IStorageService,
  ) {
    l.info('SystemMessageService initialization...');
    this.systemMessageStorage = systemMessageStorage;
  }

  use(name: string, systemMessageComputer: SystemMessageComputer) {
    if (this.systemMessageComputers.has(name)) {
      throw new Error(
        `A systemMessage computer with the name "${name}" already exists.`,
      );
    }
    l.info(`Registered systemMessage computer with the name "${name}".`);
    this.systemMessageComputers.set(name, systemMessageComputer);
  }

  async syncSystemMessages(): Promise<void> {
    l.info('getting systemMessages from S3...');
    const systemMessages = await this.s3.getSystemMessages();
    l.info('syncing systemMessages to redis...');
    await this.systemMessageStorage.syncSystemMessages(systemMessages);
  }

  async computeSystemMessage(
    systemMessageName: string,
    context: ChatInputPayload,
  ): Promise<SystemMessageType> {
    l.info(`getting systemMessage: ${systemMessageName} computer from map...`);
    const systemMessageComputer =
      this.systemMessageComputers.get(systemMessageName);
    l.info(`getting systemMessage: ${systemMessageName} from redis...`);
    const systemMessage =
      await this.systemMessageStorage.getSystemMessageByName(systemMessageName);

    if (!systemMessage) {
      throw new Error(
        `SystemMessage with name "${systemMessageName}" does not exist. Please upload SystemMessages with model presets to AWS S3 for sync to Redis and restart the App.`,
      );
    }

    l.info(
      `checking if systemMessage by name: ${systemMessageName} and systemMessageComputer exists...`,
    );
    if (systemMessage && systemMessageComputer) {
      l.info(
        `computing systemMessage: ${systemMessageName} with systemMessageComputer...`,
      );
      return systemMessageComputer(systemMessage, context);
    }

    return systemMessage;
  }
}
