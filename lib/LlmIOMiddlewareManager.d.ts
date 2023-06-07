import { AsyncLLMMiddleware } from './@types';
export declare class LlmIOManager {
    private llmInputMiddlewareChain;
    private llmOutputMiddlewareChain;
    useInput(name: string, middleware: AsyncLLMMiddleware): void;
    useOutput(name: string, middleware: AsyncLLMMiddleware): void;
    executeInputMiddlewareChain(inputText: string): Promise<void>;
    executeOutputMiddlewareChain(outputText: string): Promise<void>;
    private executeMiddlewareChain;
}
//# sourceMappingURL=LlmIOMiddlewareManager.d.ts.map