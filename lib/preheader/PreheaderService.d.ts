import { LLMPreheaderComputer } from '../@types';
import { S3Service } from '../S3Service';
import { PreheaderStorage } from './PreheaderStorage';
import { PreheaderType } from '../schema/CreateChatCompletionRequestSchema';
export declare class PreheaderService {
    private readonly preheaderStorage;
    private readonly s3;
    private preheaderComputers;
    constructor(preheaderStorage: PreheaderStorage, s3: S3Service);
    use(name: string, preheaderComputer: LLMPreheaderComputer): void;
    syncPreheaders(): Promise<void>;
    computePreheader(botName: string): Promise<PreheaderType>;
}
//# sourceMappingURL=PreheaderService.d.ts.map