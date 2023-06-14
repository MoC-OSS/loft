"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemMessageService = void 0;
class SystemMessageService {
    systemMessageStorage;
    s3;
    systemMessageComputers = new Map();
    constructor(systemMessageStorage, s3) {
        this.systemMessageStorage = systemMessageStorage;
        this.s3 = s3;
        this.systemMessageStorage = systemMessageStorage;
    }
    use(name, systemMessageComputer) {
        if (this.systemMessageComputers.has(name)) {
            throw new Error(`A systemMessage computer with the name "${name}" already exists.`);
        }
        this.systemMessageComputers.set(name, systemMessageComputer);
    }
    async syncSystemMessages() {
        // get SystemMessages object from S3
        const systemMessages = await this.s3.getSystemMessages();
        // sync SystemMessages to redis
        await this.systemMessageStorage.syncSystemMessages(systemMessages);
    }
    async computeSystemMessage(systemMessageName, context) {
        const systemMessageComputer = this.systemMessageComputers.get(systemMessageName);
        const systemMessage = await this.systemMessageStorage.getSystemMessageByName(systemMessageName);
        if (!systemMessage) {
            throw new Error(`SystemMessage with name "${systemMessageName}" does not exist. Please upload SystemMessages with model presets to AWS S3 for sync to Redis and restart the App.`);
        }
        if (systemMessage && systemMessageComputer) {
            return systemMessageComputer(systemMessage, context);
        }
        return systemMessage;
    }
}
exports.SystemMessageService = SystemMessageService;
