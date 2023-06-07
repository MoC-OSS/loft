import { Redis, Cluster } from 'ioredis';
import { CreateChatCompletionRequestType, PreheaderType } from '../schema/CreateChatCompletionRequestSchema';
export declare class PreheaderStorage {
    private client;
    constructor(client: Redis | Cluster);
    syncPreheaders(data: CreateChatCompletionRequestType): Promise<void>;
    getPreheaderByName(name: string): Promise<PreheaderType>;
    updatePreheaderByName(name: string, newPreheader: string): Promise<void>;
    deletePreheaderByName(name: string): Promise<void>;
}
//# sourceMappingURL=PreheaderStorage.d.ts.map