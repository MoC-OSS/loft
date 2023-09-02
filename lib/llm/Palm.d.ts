import { PalmMessage } from '../@types';
/**
 * Represents the input and output examples for the model.
 */
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
export declare class Palm {
    private project;
    private apiEndpoint;
    private location;
    private publisher;
    private predictionServiceClient;
    constructor(project: string, apiEndpoint?: string, location?: string, publisher?: string);
    private getEndpoint;
    callPredict(instance: PredictionInstance, parameters: PredictionParameters, model?: string): Promise<string | number | boolean | object | import("@google-cloud/aiplatform/build/src/value-converter").ValueType | null | undefined>;
}
export {};
//# sourceMappingURL=Palm.d.ts.map