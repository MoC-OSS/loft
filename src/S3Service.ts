import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  PutBucketLifecycleConfigurationCommand,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import {
  CreateChatCompletionRequestType,
  createChatCompletionRequestSchema,
} from './schema/CreateChatCompletionRequestSchema';
import { PromptSchema, PromptsFileType } from './schema/PromptSchema';

export class S3Service {
  private readonly client: S3Client;

  constructor(
    private readonly env: string,
    private readonly region: string,
    private readonly bucketName: string,
    private readonly botName: string,
  ) {
    this.client = new S3Client({ region: this.region });
    const command = new PutBucketLifecycleConfigurationCommand(
      this.getS3LogFileParams(),
    );
    this.client.send(command);
  }

  async getFile(filename: string) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: filename,
      });
      const response = await this.client.send(command);

      return response.Body;
    } catch (err) {
      if (
        err instanceof S3ServiceException &&
        err.$metadata.httpStatusCode == 404
      ) {
        return null;
      }
      throw err;
    }
  }

  async getSystemMessages(): Promise<CreateChatCompletionRequestType> {
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
      return createChatCompletionRequestSchema.parse(systemMessages);
    } catch (error) {
      console.error(error);
      await this.logToS3((error as Error).toString());
      throw error;
    }
  }

  async getPrompts(): Promise<PromptsFileType> {
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
      return PromptSchema.parse(prompts);
    } catch (error) {
      console.error(error);
      await this.logToS3((error as Error).toString());
      throw error;
    }
  }

  async logToS3(data: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: `${this.botName}/${this.env}/log_errors.txt`,
      Body: data,
    });

    await this.client.send(command).catch((err) => console.error(err));
  }

  private getS3LogFileParams() {
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
