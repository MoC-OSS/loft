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
    getFile(filename: string): Promise<(import("stream").Readable & import("@smithy/types").SdkStreamMixin) | (Blob & import("@smithy/types").SdkStreamMixin) | (ReadableStream<any> & import("@smithy/types").SdkStreamMixin) | null | undefined>;
    getSystemMessages(): Promise<CreateChatCompletionRequestType>;
    getPrompts(): Promise<PromptsFileType>;
    logToS3(data: string): Promise<void>;
}
//# sourceMappingURL=S3Service.d.ts.map