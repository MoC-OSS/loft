/// <reference types="node" />
import { CreateChatCompletionRequestType } from './schema/CreateChatCompletionRequestSchema';
import { PromptsFileType } from './schema/PromptSchema';
export declare class S3Service {
    private readonly env;
    private readonly region;
    private readonly bucketName;
    private readonly appName;
    private readonly client;
    constructor(env: string, region: string, bucketName: string, appName: string);
    getFile(filename: string): Promise<import("@smithy/types").SdkStream<import("stream").Readable | ReadableStream<any> | Blob | undefined> | null | undefined>;
    getSystemMessages(): Promise<CreateChatCompletionRequestType>;
    getPrompts(): Promise<PromptsFileType>;
    logToS3(data: string): Promise<void>;
    private getS3LogFileParams;
}
//# sourceMappingURL=S3Service.d.ts.map