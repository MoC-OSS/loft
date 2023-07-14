import { OutputContext } from './@types';
export type OpenAiFunctionArgs = any;
export type OpenAiFunction = (ctx: OutputContext, args: OpenAiFunctionArgs) => Promise<string>;
export declare class FunctionManager {
    functions: Map<string, OpenAiFunction>;
    constructor();
    use(name: string, fn: OpenAiFunction): void;
    executeFunction(expectedFnName: string, args: OpenAiFunctionArgs, ctx: OutputContext): Promise<string>;
}
//# sourceMappingURL=FunctionManager.d.ts.map