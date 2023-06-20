import { InputData, SystemMessageComputer } from '../@types';
import { S3Service } from '../S3Service';
import { SystemMessageType } from '../schema/CreateChatCompletionRequestSchema';
import { SystemMessageStorage } from './SystemMessageStorage';
export declare class SystemMessageService {
    private readonly systemMessageStorage;
    private readonly s3;
    private systemMessageComputers;
    constructor(systemMessageStorage: SystemMessageStorage, s3: S3Service);
    use(name: string, systemMessageComputer: SystemMessageComputer): void;
    syncSystemMessages(): Promise<void>;
    computeSystemMessage(systemMessageName: string, context: InputData): Promise<SystemMessageType>;
}
//# sourceMappingURL=SystemMessageService.d.ts.map