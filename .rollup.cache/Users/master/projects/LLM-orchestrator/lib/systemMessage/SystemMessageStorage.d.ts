import { Redis, Cluster } from 'ioredis';
import { CreateChatCompletionRequestType, SystemMessageType } from '../schema/CreateChatCompletionRequestSchema';
export declare class SystemMessageStorage {
    private client;
    constructor(client: Redis | Cluster);
    syncSystemMessages(data: CreateChatCompletionRequestType): Promise<void>;
    getSystemMessageByName(name: string): Promise<SystemMessageType | null>;
    updateSystemMessageByName(name: string, newSystemMessage: string): Promise<void>;
    deleteSystemMessageByName(name: string): Promise<void>;
}
//# sourceMappingURL=SystemMessageStorage.d.ts.map