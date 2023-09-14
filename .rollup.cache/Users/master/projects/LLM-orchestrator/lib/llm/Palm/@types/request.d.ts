import { PalmMessage } from '../../../@types';
interface Example {
    input: {
        content: string;
    };
    output: {
        content: string;
    };
}
export interface PredictionInstance {
    context?: string;
    examples?: Example[];
    messages: PalmMessage[];
}
export interface PredictionParameters {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
}
export {};
//# sourceMappingURL=request.d.ts.map