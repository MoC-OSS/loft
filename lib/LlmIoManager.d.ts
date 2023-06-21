import { AsyncLLMInputMiddleware, AsyncLLMOutputMiddleware, InputContext, OutputContext } from './@types';
import { HistoryStorage } from './HistoryStorage';
export type InputMiddlewareContext = {
    message: string;
};
export declare class LlmIOManager {
    private readonly hs;
    private llmInputMiddlewareChain;
    private llmOutputMiddlewareChain;
    constructor(hs: HistoryStorage);
    useInput(name: string, middleware: AsyncLLMInputMiddleware): void;
    useOutput(name: string, middleware: AsyncLLMOutputMiddleware): void;
    executeInputMiddlewareChain(inputContext: InputContext): Promise<InputContext>;
    executeOutputMiddlewareChain(outputContext: OutputContext): Promise<[status: string, outputContext: OutputContext]>;
}
//# sourceMappingURL=LlmIoManager.d.ts.map