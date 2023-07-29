import { PromptComputer, SessionProps } from '../@types';
import { S3Service } from '../S3Service';
import { PromptType } from '../schema/PromptSchema';
import { PromptStorage } from './PromptStorage';
export declare class PromptService {
    private readonly promptStorage;
    private readonly s3;
    private promptComputers;
    constructor(promptStorage: PromptStorage, s3: S3Service);
    use(name: string, promptComputer: PromptComputer): void;
    syncPrompts(): Promise<void>;
    computePrompt(promptName: string, session: SessionProps): Promise<PromptType>;
}
//# sourceMappingURL=PromptService.d.ts.map