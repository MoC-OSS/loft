import { Storage } from '@google-cloud/storage';
import { createChatCompletionRequestSchema, } from './../../schema/CreateChatCompletionRequestSchema';
import { PromptSchema } from './../../schema/PromptSchema';
import { getLogger } from './../../Logger';
const l = getLogger('GCPStorageService');
export class CloudStorageService {
    env;
    bucketName;
    appName;
    storage;
    constructor(env, bucketName, appName) {
        this.env = env;
        this.bucketName = bucketName;
        this.appName = appName;
        l.info('GCPStorageService initialization...');
        this.storage = new Storage({});
        l.info(`Configured Google Cloud Storage.`);
    }
    async getFile(filename) {
        try {
            l.info(`getting file: ${filename} from GCP Storage...`);
            const file = this.storage.bucket(this.bucketName).file(filename);
            const [data] = await file.download();
            return data;
        }
        catch (err) {
            // if (err.code === 404) {
            //   l.warn(`File ${filename} not found!`);
            //   return null;
            // }
            throw err;
        }
    }
    async getSystemMessages() {
        try {
            l.info('getting systemMessages from GCP Storage...');
            const fileName = `${this.appName}/${this.env}/system_messages.json`;
            const file = await this.getFile(fileName);
            if (file === null) {
                const errorMessage = `File ${fileName} not found!`;
                l.error(errorMessage, 'App will be terminated.');
                await this.logToGCP(errorMessage);
                process.exit(1);
            }
            l.info('parsing systemMessages...');
            const systemMessages = JSON.parse(file.toString());
            l.info('validating systemMessages...');
            return createChatCompletionRequestSchema.parse(systemMessages);
        }
        catch (error) {
            l.error(error);
            await this.logToGCP(error.toString());
            throw error;
        }
    }
    async getPrompts() {
        try {
            l.info('getting prompts from GCP Storage...');
            const fileName = `${this.appName}/${this.env}/prompts.json`;
            const file = await this.getFile(fileName);
            if (file === null) {
                const errorMessage = `File ${fileName} not found!`;
                l.error(errorMessage, 'App will be terminated.');
                await this.logToGCP(errorMessage);
                process.exit(1);
            }
            l.info('parsing prompts...');
            const prompts = JSON.parse(file.toString());
            l.info('validating prompts...');
            return PromptSchema.parse(prompts);
        }
        catch (error) {
            l.error(error);
            await this.logToGCP(error.toString());
            throw error;
        }
    }
    async logToGCP(data) {
        l.info('logging error to GCP Storage...');
        const file = this.storage
            .bucket(this.bucketName)
            .file(`${this.appName}/${this.env}/log_errors.txt`);
        await file.save(data).catch((err) => l.error(err));
    }
}
