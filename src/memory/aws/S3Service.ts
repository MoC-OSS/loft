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
} from '../../schema/CreateChatCompletionRequestSchema';
import { PromptSchema, PromptsFileType } from '../../schema/PromptSchema';
import { getLogger } from '../../Logger';
import { IStorageService } from '../CloudObjectStorage';

const l = getLogger('S3Service');

export class S3Service implements IStorageService {
  private readonly client: S3Client;

  constructor(
    private readonly env: string,
    private readonly region: string,
    private readonly bucketName: string,
    private readonly appName: string,
  ) {
    l.info('S3Service initialization...');
    this.client = new S3Client({ region: this.region });
    l.info(`Put Bucket Lifecycle Configuration to error log files...`);
  }

  async getFile(filename: string) {
    try {
      l.info(`getting file: ${filename} from S3...`);
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
        l.warn(`File ${filename} not found!`);
        return null;
      }
      throw err;
    }
  }

  async getSystemMessages(): Promise<CreateChatCompletionRequestType> {
    try {
      l.info('getting systemMessages from S3...');
      const fileName = `${this.appName}/${this.env}/system_messages.json`;
      const file = await this.getFile(fileName);

      if (file === null || file === undefined) {
        const errorMessage = `File ${fileName} not found!`;
        l.error(errorMessage, 'App will be terminated.');
        await this.logToS3(errorMessage);
        process.exit(1);
      }

      l.info('parsing systemMessages...');
      const systemMessages = JSON.parse(await file.transformToString());
      l.info('validating systemMessages...');
      return createChatCompletionRequestSchema.parse(systemMessages);
    } catch (error) {
      l.error(error);
      await this.logToS3((error as Error).toString());
      throw error;
    }
  }

  async getPrompts(): Promise<PromptsFileType> {
    try {
      l.info('getting prompts from S3...');
      const fileName = `${this.appName}/${this.env}/prompts.json`;
      const file = await this.getFile(fileName);

      if (file === null || file === undefined) {
        const errorMessage = `File ${fileName} not found!`;
        l.error(errorMessage, 'App will be terminated.');
        await this.logToS3(errorMessage);
        process.exit(1);
      }

      l.info('parsing prompts...');
      const prompts = JSON.parse(await file.transformToString());
      l.info('validating prompts...');
      return PromptSchema.parse(prompts);
    } catch (error) {
      l.error(error);
      await this.logToS3((error as Error).toString());
      throw error;
    }
  }

  async logToS3(data: string) {
    l.info('logging error to S3...');
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: `${this.appName}/${this.env}/log_errors.txt`,
      Body: data,
    });

    await this.client.send(command).catch((err) => l.error(err));
  }
}
