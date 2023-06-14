import { EventHandler, defaultHandler } from './EventManager';
import { AsyncLLMInputMiddleware, AsyncLLMOutputMiddleware, Config, InputData, SystemMessageComputer } from './@types/index';
import { ChatCompletionRequestMessage, ChatCompletionResponseMessage } from 'openai';
import { HistoryStorage } from './HistoryStorage';
import { SystemMessageService } from './systemMessage/SystemMessageService';
export declare class LlmOrchestrator {
    private readonly cfg;
    private readonly sms;
    private readonly hs;
    private readonly eventManager;
    private readonly llmIOManager;
    private readonly openai;
    private readonly completionQueue;
    private readonly completionWorker;
    private readonly llmApiCallQueue;
    private readonly llmApiCallWorker;
    private constructor();
    static createInstance(cfg: Config, sms: SystemMessageService, hs: HistoryStorage): Promise<LlmOrchestrator>;
    private initialize;
    chatCompletion(data: InputData): Promise<void>;
    callAgain(data: {
        chatId: string;
        message: ChatCompletionResponseMessage | ChatCompletionRequestMessage;
    }): Promise<void>;
    syncSystemMessages(): Promise<void>;
    useComputeSystemMessage(name: string, handler: SystemMessageComputer): void;
    useDefaultHandler(eventHandler: defaultHandler): void;
    useEventHandler(name: string, eventHandler: EventHandler): void;
    useLLMInput(name: string, middleware: AsyncLLMInputMiddleware): void;
    useLLMOutput(name: string, middleware: AsyncLLMOutputMiddleware): void;
    private llmApiCallProcessor;
    private chatCompletionProcessor;
}
//# sourceMappingURL=LlmOrchestrator.d.ts.map