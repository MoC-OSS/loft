import { EventHandler, defaultHandler } from './EventManager';
import { AsyncLLMMiddleware, Config, InputData, LLMPreheaderComputer } from './@types/index';
export declare class LlmOrchestrator {
    private readonly cfg;
    private readonly hs;
    private readonly ps;
    private readonly eventManager;
    private readonly llmIOManager;
    private readonly openai;
    private readonly completionQueue;
    private readonly completionWorker;
    private constructor();
    static createInstance(cfg: Config): Promise<LlmOrchestrator>;
    private initialize;
    chatCompletion(data: InputData): Promise<void>;
    syncPreheaders(): Promise<void>;
    useComputePreheader(name: string, preheaderComputer: LLMPreheaderComputer): void;
    useDefaultHandler(eventHandler: defaultHandler): void;
    useEventHandler(name: string, eventHandler: EventHandler): void;
    useLLMInput(name: string, middleware: AsyncLLMMiddleware): void;
    useLLMOutput(name: string, middleware: AsyncLLMMiddleware): void;
    private chatCompletionProcessor;
}
//# sourceMappingURL=LlmOrchestrator.d.ts.map