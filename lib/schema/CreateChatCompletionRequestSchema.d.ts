import { z } from 'zod';
declare const ExampleSchema: z.ZodObject<{
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
}>;
export declare const createChatCompletionRequestSchema: z.ZodObject<{
    systemMessages: z.ZodArray<z.ZodObject<{
        name: z.ZodEffects<z.ZodString, string, string>;
        systemMessage: z.ZodString;
        examples: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
        }>, "many">>;
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
        systemMessage: string;
        model: string;
        modelPreset: {
            temperature: number;
            maxOutputTokens: number;
            topP: number;
            topK: number;
        };
        examples?: {
            input: {
                content: string;
            };
            output: {
                content: string;
            };
        }[] | undefined;
    }, {
        name: string;
        systemMessage: string;
        model: string;
        modelPreset: {
            temperature: number;
            maxOutputTokens: number;
            topP: number;
            topK: number;
        };
        examples?: {
            input: {
                content: string;
            };
            output: {
                content: string;
            };
        }[] | undefined;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    systemMessages: {
        name: string;
        systemMessage: string;
        model: string;
        modelPreset: {
            temperature: number;
            maxOutputTokens: number;
            topP: number;
            topK: number;
        };
        examples?: {
            input: {
                content: string;
            };
            output: {
                content: string;
            };
        }[] | undefined;
    }[];
}, {
    systemMessages: {
        name: string;
        systemMessage: string;
        model: string;
        modelPreset: {
            temperature: number;
            maxOutputTokens: number;
            topP: number;
            topK: number;
        };
        examples?: {
            input: {
                content: string;
            };
            output: {
                content: string;
            };
        }[] | undefined;
    }[];
}>;
export type CreateChatCompletionRequestType = z.infer<typeof createChatCompletionRequestSchema>;
export type SystemMessageType = CreateChatCompletionRequestType['systemMessages'][number];
export type PalmExample = z.infer<typeof ExampleSchema>;
export type PalmExamples = SystemMessageType['examples'];
export {};
//# sourceMappingURL=CreateChatCompletionRequestSchema.d.ts.map