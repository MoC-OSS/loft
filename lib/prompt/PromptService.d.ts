import { PromptComputer } from '../@types';
import { PromptType } from '../schema/PromptSchema';
import { PromptStorage } from './PromptStorage';
import { IStorageService } from '../memory/CloudObjectStorage';
import { Session } from '../session/Session';
export declare class PromptService {
    private readonly promptStorage;
    private readonly s3;
    private promptComputers;
    constructor(promptStorage: PromptStorage, s3: IStorageService);
    use(name: string, promptComputer: PromptComputer): void;
    syncPrompts(): Promise<void>;
    computePrompt(promptName: string, session: Session): Promise<PromptType>;
}
//# sourceMappingURL=PromptService.d.ts.map