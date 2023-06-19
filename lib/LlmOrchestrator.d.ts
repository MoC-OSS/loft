import { EventHandler, defaultHandler } from './EventManager';
import { AsyncLLMInputMiddleware, AsyncLLMOutputMiddleware, Config, InputContext, InputData, PromptComputer, SystemMessageComputer } from './@types/index';
import { HistoryStorage } from './HistoryStorage';
import { SystemMessageService } from './systemMessage/SystemMessageService';
import { PromptService } from './prompt/PromptService';
export declare class LlmOrchestrator {
    private readonly cfg;
    private readonly sms;
    private readonly ps;
    private readonly hs;
    private readonly eventManager;
    private readonly llmIOManager;
    private readonly openai;
    private readonly completionQueue;
    private readonly completionWorker;
    private readonly llmApiCallQueue;
    private readonly llmApiCallWorker;
    private constructor();
    static createInstance(cfg: Config, sms: SystemMessageService, ps: PromptService, hs: HistoryStorage): Promise<LlmOrchestrator>;
    private initialize;
    chatCompletion(data: InputData): Promise<void>;
    injectPromptAndSend(promptName: string, userInput: InputContext): Promise<void>;
    syncSystemMessagesAndPrompts(): Promise<void>;
    useComputeSystemMessage(name: string, handler: SystemMessageComputer): void;
    useComputePrompt(name: string, handler: PromptComputer): void;
    useDefaultHandler(eventHandler: defaultHandler): void;
    useEventHandler(name: string, eventHandler: EventHandler): void;
    useLLMInput(name: string, middleware: AsyncLLMInputMiddleware): void;
    useLLMOutput(name: string, middleware: AsyncLLMOutputMiddleware): void;
    private llmApiCallProcessor;
    private chatCompletionProcessor;
}
//# sourceMappingURL=LlmOrchestrator.d.ts.map