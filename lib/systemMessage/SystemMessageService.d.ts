import { ChatInputPayload, SystemMessageComputer } from '../@types';
import { SystemMessageType } from '../schema/CreateChatCompletionRequestSchema';
import { SystemMessageStorage } from './SystemMessageStorage';
import { IStorageService } from '../memory/CloudObjectStorage';
export declare class SystemMessageService {
    private readonly systemMessageStorage;
    private readonly s3;
    private systemMessageComputers;
    constructor(systemMessageStorage: SystemMessageStorage, s3: IStorageService);
    use(name: string, systemMessageComputer: SystemMessageComputer): void;
    syncSystemMessages(): Promise<void>;
    computeSystemMessage(systemMessageName: string, context: ChatInputPayload): Promise<SystemMessageType>;
}
//# sourceMappingURL=SystemMessageService.d.ts.map