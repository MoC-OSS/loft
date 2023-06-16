"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Service = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const CreateChatCompletionRequestSchema_1 = require("./schema/CreateChatCompletionRequestSchema");
const PromptSchema_1 = require("./schema/PromptSchema");
class S3Service {
    env;
    region;
    bucketName;
    botName;
    client;
    constructor(env, region, bucketName, botName) {
        this.env = env;
        this.region = region;
        this.bucketName = bucketName;
        this.botName = botName;
        this.client = new client_s3_1.S3Client({ region: this.region });
        const command = new client_s3_1.PutBucketLifecycleConfigurationCommand(this.getS3LogFileParams());
        this.client.send(command);
    }
    async getFile(filename) {
        try {
            const command = new client_s3_1.GetObjectCommand({
                Bucket: this.bucketName,
                Key: filename,
            });
            const response = await this.client.send(command);
            return response.Body;
        }
        catch (err) {
            if (err instanceof client_s3_1.S3ServiceException &&
                err.$metadata.httpStatusCode == 404) {
                return null;
            }
            throw err;
        }
    }
    async getSystemMessages() {
        try {
            const fileName = `${this.botName}/${this.env}/system_messages.json`;
            const file = await this.getFile(fileName);
            if (file === null || file === undefined) {
                const errorMessage = `File ${fileName} not found!`;
                console.error(errorMessage, 'App will be terminated.');
                await this.logToS3(errorMessage);
                process.exit(1);
            }
            const systemMessages = JSON.parse(await file.transformToString());
            return CreateChatCompletionRequestSchema_1.createChatCompletionRequestSchema.parse(systemMessages);
        }
        catch (error) {
            console.error(error);
            await this.logToS3(error.toString());
            throw error;
        }
    }
    async getPrompts() {
        try {
            const fileName = `${this.botName}/${this.env}/prompts.json`;
            const file = await this.getFile(fileName);
            if (file === null || file === undefined) {
                const errorMessage = `File ${fileName} not found!`;
                console.error(errorMessage, 'App will be terminated.');
                await this.logToS3(errorMessage);
                process.exit(1);
            }
            const prompts = JSON.parse(await file.transformToString());
            return PromptSchema_1.PromptSchema.parse(prompts);
        }
        catch (error) {
            console.error(error);
            await this.logToS3(error.toString());
            throw error;
        }
    }
    async logToS3(data) {
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: `${this.botName}/${this.env}/log_errors.txt`,
            Body: data,
        });
        await this.client.send(command).catch((err) => console.error(err));
    }
    getS3LogFileParams() {
        return {
            Bucket: this.bucketName,
            LifecycleConfiguration: {
                Rules: [
                    {
                        ID: 'Delete log_*.txt after 30 days',
                        Status: 'Enabled',
                        Filter: {
                            Prefix: 'log_',
                        },
                        Expiration: {
                            Days: 30,
                        },
                    },
                ],
            },
        };
    }
}
exports.S3Service = S3Service;
