import AWS from 'aws-sdk';
import {
  CreateChatCompletionRequestType,
  createChatCompletionRequestSchema,
} from './schema/CreateChatCompletionRequestSchema';

export class S3Service {
  private readonly s3: AWS.S3;

  constructor(
    private readonly env: string,
    private readonly region: string,
    private readonly bucketName: string,
    private readonly botName: string,
  ) {
    AWS.config.update({
      region: this.region,
    });
    this.s3 = new AWS.S3();
    this.s3.putBucketLifecycleConfiguration(this.getS3LogFileParams());
  }

  async getFile(filename: string) {
    try {
      const data = await this.s3
        .getObject({ Bucket: this.bucketName, Key: filename })
        .promise();

      // Make sure the retrieved object contains data
      if (!data.Body) {
        throw new Error('No data in S3 object');
      }

      return data.Body;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async getPreheaders(): Promise<CreateChatCompletionRequestType> {
    try {
      const file = await this.getFile(
        `${this.botName}/${this.env}/preheaders.json`,
      );
      const preheaders = JSON.parse(file.toString());
      return createChatCompletionRequestSchema.parse(preheaders);
    } catch (error) {
      console.error(error);
      throw error;
    }
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
