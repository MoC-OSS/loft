import { AsyncLLMInputMiddleware, AsyncLLMOutputMiddleware, ChatInputPayload, OutputContext } from './@types';
export type InputMiddlewareContext = {
    message: string;
};
export declare class LlmIOManager {
    private llmInputMiddlewareChain;
    private llmOutputMiddlewareChain;
    constructor();
    useInput(name: string, middleware: AsyncLLMInputMiddleware): void;
    useOutput(name: string, middleware: AsyncLLMOutputMiddleware): void;
    executeInputMiddlewareChain(inputContext: ChatInputPayload): Promise<ChatInputPayload>;
    executeOutputMiddlewareChain(outputContext: OutputContext): Promise<[status: string, outputContext: OutputContext]>;
}
//# sourceMappingURL=LlmIoManager.d.ts.map