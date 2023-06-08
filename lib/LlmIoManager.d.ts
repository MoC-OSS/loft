import { AsyncLLMMiddleware } from './@types';
export declare class LlmIOManager {
    private llmInputMiddlewareChain;
    private llmOutputMiddlewareChain;
    useInput(name: string, middleware: AsyncLLMMiddleware): void;
    useOutput(name: string, middleware: AsyncLLMMiddleware): void;
    executeInputMiddlewareChain(inputText: string): Promise<string>;
    executeOutputMiddlewareChain(outputText: string): Promise<string>;
    private executeMiddlewareChain;
}
//# sourceMappingURL=LlmIoManager.d.ts.map