/// <reference types="node" />
import { CreateChatCompletionRequestType } from './schema/CreateChatCompletionRequestSchema';
export declare class S3Service {
    private readonly env;
    private readonly region;
    private readonly bucketName;
    private readonly botName;
    private readonly client;
    constructor(env: string, region: string, bucketName: string, botName: string);
    getFile(filename: string): Promise<import("@aws-sdk/types").SdkStream<import("stream").Readable | ReadableStream<any> | Blob | undefined> | null | undefined>;
    getPreheaders(): Promise<CreateChatCompletionRequestType>;
    logToS3(data: string): Promise<void>;
    private getS3LogFileParams;
}
//# sourceMappingURL=S3Service.d.ts.map