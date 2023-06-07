"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreheaderService = void 0;
class PreheaderService {
    preheaderStorage;
    s3;
    preheaderComputers = new Map();
    constructor(preheaderStorage, s3) {
        this.preheaderStorage = preheaderStorage;
        this.s3 = s3;
        this.preheaderStorage = preheaderStorage;
    }
    use(name, preheaderComputer) {
        if (this.preheaderComputers.has(name)) {
            throw new Error(`A preheader computer with the name "${name}" already exists.`);
        }
        this.preheaderComputers.set(name, preheaderComputer);
    }
    async syncPreheaders() {
        // get preheaders object from S3
        const preheaders = await this.s3.getPreheaders();
        // sync preheaders to redis
        await this.preheaderStorage.syncPreheaders(preheaders);
    }
    async computePreheader(botName) {
        const preheaderComputer = this.preheaderComputers.get(botName);
        const preheader = await this.preheaderStorage.getPreheaderByName(botName);
        if (!preheader) {
            throw new Error(`Preheader with name "${botName}" does not exist. Please upload Preheaders with model presets to AWS S3 for sync to Redis and restart the App.`);
        }
        if (preheader && preheaderComputer) {
            return preheaderComputer(preheader);
        }
        return preheader;
    }
}
exports.PreheaderService = PreheaderService;
