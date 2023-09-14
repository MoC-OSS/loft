import { OutputContext } from './@types';
export type OpenAiFunctionArgs = any;
export type OpenAiFunction = (ctx: OutputContext, args: OpenAiFunctionArgs) => Promise<string>;
export declare class FunctionManager {
    functions: Map<string, OpenAiFunction>;
    constructor();
    use(name: string, fn: OpenAiFunction): void;
}
//# sourceMappingURL=FunctionManager.d.ts.map