import { EventHandler, DefaultHandler, ErrorHandler } from './EventManager';
import { AsyncLLMInputMiddleware, AsyncLLMOutputMiddleware, Config, InputData, MiddlewareStatus, OutputContext, PromptComputer, SystemMessageComputer } from './@types/index';
import { ChatCompletionRequestMessageRoleEnum } from 'openai';
import { SessionStorage } from './session/SessionStorage';
import { SystemMessageService } from './systemMessage/SystemMessageService';
import { PromptService } from './prompt/PromptService';
import { Session } from './session/Session';
import { OpenAiFunction } from './FunctionManager';
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
    private readonly eventManager;
    private readonly llmIOManager;
    private readonly fnManager;
    private readonly openai;
    private readonly completionQueue;
    private readonly completionWorker;
    private readonly llmApiCallQueue;
    private readonly llmApiCallWorker;
    private constructor();
    static createInstance(cfg: Config, sms: SystemMessageService, ps: PromptService, hs: SessionStorage): Promise<ChatCompletion>;
    private initialize;
    chatCompletion(data: InputData): Promise<void>;
    injectPromptAndSend(promptName: string, session: Session, message: string, promptRole?: ChatCompletionRequestMessageRoleEnum, messageRole?: ChatCompletionRequestMessageRoleEnum): Promise<void>;
    callAgain(session: Session, message: string, role?: ChatCompletionRequestMessageRoleEnum): Promise<{
        status?: MiddlewareStatus;
        newOutputContext: OutputContext | undefined;
    }>;
    deleteSessionsById(sessionId: string): Promise<void>;
    syncSystemMessagesAndPrompts(): Promise<void>;
    useComputeSystemMessage(name: string, handler: SystemMessageComputer): void;
    useComputePrompt(name: string, handler: PromptComputer): void;
    useDefaultHandler(eventHandler: DefaultHandler): void;
    useErrorHandler(eventHandler: ErrorHandler): void;
    useEventHandler(name: string, eventHandler: EventHandler): void;
    useLLMInput(name: string, middleware: AsyncLLMInputMiddleware): void;
    useLLMOutput(name: string, middleware: AsyncLLMOutputMiddleware): void;
    useFunction(name: string, fn: OpenAiFunction): void;
    private callFunction;
    private getChatCompletionInitiatorName;
    private chatCompletionCallProcessor;
    private chatCompletionBeginProcessor;
}
//# sourceMappingURL=ChatCompletion.d.ts.map