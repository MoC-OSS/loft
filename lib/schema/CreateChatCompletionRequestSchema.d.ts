import { z } from 'zod';
export declare const createChatCompletionRequestSchema: z.ZodObject<{
    systemMessages: z.ZodArray<z.ZodObject<{
        name: z.ZodEffects<z.ZodString, string, string>;
        systemMessage: z.ZodString;
        examples: z.ZodArray<z.ZodObject<{
            input: z.ZodObject<{
                content: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                content: string;
            }, {
                content: string;
            }>;
            output: z.ZodObject<{
                content: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                content: string;
            }, {
                content: string;
            }>;
        }, "strip", z.ZodTypeAny, {
            input: {
                content: string;
            };
            output: {
                content: string;
            };
        }, {
            input: {
                content: string;
            };
            output: {
                content: string;
            };
        }>, "many">;
        model: z.ZodString;
        modelPreset: z.ZodObject<{
            temperature: z.ZodNumber;
            maxOutputTokens: z.ZodNumber;
            topP: z.ZodNumber;
            topK: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            temperature: number;
            maxOutputTokens: number;
            topP: number;
            topK: number;
        }, {
            temperature: number;
            maxOutputTokens: number;
            topP: number;
            topK: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        modelPreset: {
            temperature: number;
            maxOutputTokens: number;
            topP: number;
            topK: number;
        };
        systemMessage: string;
        examples: {
            input: {
                content: string;
            };
            output: {
                content: string;
            };
        }[];
        model: string;
    }, {
        name: string;
        modelPreset: {
            temperature: number;
            maxOutputTokens: number;
            topP: number;
            topK: number;
        };
        systemMessage: string;
        examples: {
            input: {
                content: string;
            };
            output: {
                content: string;
            };
        }[];
        model: string;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    systemMessages: {
        name: string;
        modelPreset: {
            temperature: number;
            maxOutputTokens: number;
            topP: number;
            topK: number;
        };
        systemMessage: string;
        examples: {
            input: {
                content: string;
            };
            output: {
                content: string;
            };
        }[];
        model: string;
    }[];
}, {
    systemMessages: {
        name: string;
        modelPreset: {
            temperature: number;
            maxOutputTokens: number;
            topP: number;
            topK: number;
        };
        systemMessage: string;
        examples: {
            input: {
                content: string;
            };
            output: {
                content: string;
            };
        }[];
        model: string;
    }[];
}>;
export type CreateChatCompletionRequestType = z.infer<typeof createChatCompletionRequestSchema>;
export type SystemMessageType = CreateChatCompletionRequestType['systemMessages'][number];
//# sourceMappingURL=CreateChatCompletionRequestSchema.d.ts.map