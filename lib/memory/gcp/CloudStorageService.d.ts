/// <reference types="node" />
import { CreateChatCompletionRequestType } from './../../schema/CreateChatCompletionRequestSchema';
import { PromptsFileType } from './../../schema/PromptSchema';
import { IStorageService } from '../CloudObjectStorage';
export declare class CloudStorageService implements IStorageService {
    private readonly env;
    private readonly bucketName;
    private readonly appName;
    private readonly storage;
    constructor(env: string, bucketName: string, appName: string);
    getFile(filename: string): Promise<Buffer | null>;
    getSystemMessages(): Promise<CreateChatCompletionRequestType>;
    getPrompts(): Promise<PromptsFileType>;
    logToGCP(data: string): Promise<void>;
}
//# sourceMappingURL=CloudStorageService.d.ts.map