import { z } from 'zod';
export declare const ChatCompletionFunctions: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
    parameters?: Record<string, any> | undefined;
}, {
    name: string;
    description?: string | undefined;
    parameters?: Record<string, any> | undefined;
}>;
export declare const createChatCompletionRequestSchema: z.ZodObject<{
    systemMessages: z.ZodArray<z.ZodObject<{
        name: z.ZodEffects<z.ZodString, string, string>;
        systemMessage: z.ZodString;
        modelPreset: z.ZodObject<{
            model: z.ZodString;
            functions: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
                parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            }, "strip", z.ZodTypeAny, {
                name: string;
                description?: string | undefined;
                parameters?: Record<string, any> | undefined;
            }, {
                name: string;
                description?: string | undefined;
                parameters?: Record<string, any> | undefined;
            }>, "many">>;
            function_call: z.ZodOptional<z.ZodUnion<[z.ZodObject<{
                name: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                name: string;
            }, {
                name: string;
            }>, z.ZodString]>>;
            temperature: z.ZodOptional<z.ZodNumber>;
            top_p: z.ZodOptional<z.ZodNumber>;
            n: z.ZodOptional<z.ZodNumber>;
            stream: z.ZodOptional<z.ZodBoolean>;
            stop: z.ZodOptional<z.ZodUnion<[z.ZodOptional<z.ZodArray<z.ZodString, "many">>, z.ZodString]>>;
            max_tokens: z.ZodOptional<z.ZodNumber>;
            presence_penalty: z.ZodOptional<z.ZodNumber>;
            frequency_penalty: z.ZodOptional<z.ZodNumber>;
            logit_bias: z.ZodOptional<z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodNumber>, Record<string, number>, Record<string, number>>>;
        }, "strip", z.ZodTypeAny, {
            model: string;
            functions?: {
                name: string;
                description?: string | undefined;
                parameters?: Record<string, any> | undefined;
            }[] | undefined;
            function_call?: string | {
                name: string;
            } | undefined;
            temperature?: number | undefined;
            top_p?: number | undefined;
            n?: number | undefined;
            stream?: boolean | undefined;
            stop?: string | string[] | undefined;
            max_tokens?: number | undefined;
            presence_penalty?: number | undefined;
            frequency_penalty?: number | undefined;
            logit_bias?: Record<string, number> | undefined;
        }, {
            model: string;
            functions?: {
                name: string;
                description?: string | undefined;
                parameters?: Record<string, any> | undefined;
            }[] | undefined;
            function_call?: string | {
                name: string;
            } | undefined;
            temperature?: number | undefined;
            top_p?: number | undefined;
            n?: number | undefined;
            stream?: boolean | undefined;
            stop?: string | string[] | undefined;
            max_tokens?: number | undefined;
            presence_penalty?: number | undefined;
            frequency_penalty?: number | undefined;
            logit_bias?: Record<string, number> | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        systemMessage: string;
        modelPreset: {
            model: string;
            functions?: {
                name: string;
                description?: string | undefined;
                parameters?: Record<string, any> | undefined;
            }[] | undefined;
            function_call?: string | {
                name: string;
            } | undefined;
            temperature?: number | undefined;
            top_p?: number | undefined;
            n?: number | undefined;
            stream?: boolean | undefined;
            stop?: string | string[] | undefined;
            max_tokens?: number | undefined;
            presence_penalty?: number | undefined;
            frequency_penalty?: number | undefined;
            logit_bias?: Record<string, number> | undefined;
        };
    }, {
        name: string;
        systemMessage: string;
        modelPreset: {
            model: string;
            functions?: {
                name: string;
                description?: string | undefined;
                parameters?: Record<string, any> | undefined;
            }[] | undefined;
            function_call?: string | {
                name: string;
            } | undefined;
            temperature?: number | undefined;
            top_p?: number | undefined;
            n?: number | undefined;
            stream?: boolean | undefined;
            stop?: string | string[] | undefined;
            max_tokens?: number | undefined;
            presence_penalty?: number | undefined;
            frequency_penalty?: number | undefined;
            logit_bias?: Record<string, number> | undefined;
        };
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    systemMessages: {
        name: string;
        systemMessage: string;
        modelPreset: {
            model: string;
            functions?: {
                name: string;
                description?: string | undefined;
                parameters?: Record<string, any> | undefined;
            }[] | undefined;
            function_call?: string | {
                name: string;
            } | undefined;
            temperature?: number | undefined;
            top_p?: number | undefined;
            n?: number | undefined;
            stream?: boolean | undefined;
            stop?: string | string[] | undefined;
            max_tokens?: number | undefined;
            presence_penalty?: number | undefined;
            frequency_penalty?: number | undefined;
            logit_bias?: Record<string, number> | undefined;
        };
    }[];
}, {
    systemMessages: {
        name: string;
        systemMessage: string;
        modelPreset: {
            model: string;
            functions?: {
                name: string;
                description?: string | undefined;
                parameters?: Record<string, any> | undefined;
            }[] | undefined;
            function_call?: string | {
                name: string;
            } | undefined;
            temperature?: number | undefined;
            top_p?: number | undefined;
            n?: number | undefined;
            stream?: boolean | undefined;
            stop?: string | string[] | undefined;
            max_tokens?: number | undefined;
            presence_penalty?: number | undefined;
            frequency_penalty?: number | undefined;
            logit_bias?: Record<string, number> | undefined;
        };
    }[];
}>;
export type CreateChatCompletionRequestType = z.infer<typeof createChatCompletionRequestSchema>;
export type SystemMessageType = CreateChatCompletionRequestType['systemMessages'][number];
//# sourceMappingURL=CreateChatCompletionRequestSchema.d.ts.map