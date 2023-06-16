import { Redis, Cluster } from 'ioredis';
import { PromptType, PromptsFileType } from '../schema/PromptSchema';
export declare class PromptStorage {
    private client;
    constructor(client: Redis | Cluster);
    syncPrompts(data: PromptsFileType): Promise<void>;
    getPromptByName(name: string): Promise<PromptType | null>;
    updatePromptByName(name: string, prompt: string): Promise<void>;
    deletePromptByName(name: string): Promise<void>;
}
//# sourceMappingURL=PromptStorage.d.ts.map