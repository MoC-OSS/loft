import { EventHandler, DefaultHandler } from './EventManager';
import { AsyncLLMInputMiddleware, AsyncLLMOutputMiddleware, Config, ErrorHandler, InputPayload, MiddlewareStatus, OutputContext, PromptComputer, SystemMessageComputer } from './@types/index';
import { SessionStorage } from './session/SessionStorage';
import { SystemMessageService } from './systemMessage/SystemMessageService';
import { PromptService } from './prompt/PromptService';
import { Session } from './session/Session';
import { Message } from './session/Message';
export declare enum ChatCompletionCallInitiator {
    main_flow = "MAIN_FLOW",
    injection = "INJECTION",
    call_again = "CALL_AGAIN",
    set_function_result = "SET_FUNCTION_RESULT"
}
export declare class ChatCompletion {
    private readonly cfg;
    private readonly sms;
    private readonly ps;
    private readonly hs;
    private readonly errorHandler;
    private readonly eventManager;
    private readonly llmIOManager;
    private readonly llm;
    private readonly completionQueue;
    private readonly completionWorker;
    private readonly llmApiCallQueue;
    private readonly llmApiCallWorker;
    private constructor();
    static createInstance(cfg: Config, sms: SystemMessageService, ps: PromptService, hs: SessionStorage, errorHandler: ErrorHandler): Promise<ChatCompletion>;
    private initialize;
    call(data: InputPayload): Promise<void>;
    injectPromptAndSend(promptName: string, session: Session, messages: Message[], promptRole: 'user' | 'assistant'): Promise<void>;
    /**
     * Use this method when you need to call LLM API again OR after error to continue chat flow.
     * AND only if last message at ChatHistory is user role
     *
     * @param sessionId
     * @param systemMessageName
     */
    callRetry(sessionId: Session['sessionId'], systemMessageName: string): Promise<{
        status?: MiddlewareStatus;
        newOutputContext: OutputContext | undefined;
    }>;
    deleteSessionsById(sessionId: string): Promise<void>;
    syncSystemMessagesAndPrompts(): Promise<void>;
    useComputeSystemMessage(name: string, handler: SystemMessageComputer): void;
    useComputePrompt(name: string, handler: PromptComputer): void;
    useDefaultHandler(eventHandler: DefaultHandler): void;
    useEventHandler(name: string, eventHandler: EventHandler): void;
    useLLMInput(name: string, middleware: AsyncLLMInputMiddleware): void;
    useLLMOutput(name: string, middleware: AsyncLLMOutputMiddleware): void;
    private getChatCompletionInitiatorName;
    private chatCompletionCallProcessor;
    releaseAccToChatQueue: (sessionId: Session['sessionId'], systemMessageName: Session['systemMessageName']) => Promise<void>;
    private chatCompletionBeginProcessor;
}
//# sourceMappingURL=ChatCompletion.d.ts.map