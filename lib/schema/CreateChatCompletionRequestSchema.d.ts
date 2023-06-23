import { z } from 'zod';
export declare const createChatCompletionRequestSchema: z.ZodObject<{
    systemMessages: z.ZodArray<z.ZodObject<{
        name: z.ZodEffects<z.ZodString, string, string>;
        systemMessage: z.ZodString;
        modelPreset: z.ZodObject<{
            model: z.ZodString;
            temperature: z.ZodOptional<z.ZodNumber>;
            top_p: z.ZodOptional<z.ZodNumber>;
            n: z.ZodOptional<z.ZodNumber>;
            stream: z.ZodOptional<z.ZodBoolean>;
            stop: z.ZodOptional<z.ZodUnion<[z.ZodOptional<z.ZodArray<z.ZodString, "many">>, z.ZodString]>>;
            max_tokens: z.ZodOptional<z.ZodNumber>;
            presence_penalty: z.ZodOptional<z.ZodNumber>;
            frequency_penalty: z.ZodOptional<z.ZodNumber>;
            logit_bias: z.ZodOptional<z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodNumber>, Record<string, number>, Record<string, number>>>;
            user: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            model: string;
            temperature?: number | undefined;
            top_p?: number | undefined;
            n?: number | undefined;
            stream?: boolean | undefined;
            stop?: string | string[] | undefined;
            max_tokens?: number | undefined;
            presence_penalty?: number | undefined;
            frequency_penalty?: number | undefined;
            logit_bias?: Record<string, number> | undefined;
            user?: string | undefined;
        }, {
            model: string;
            temperature?: number | undefined;
            top_p?: number | undefined;
            n?: number | undefined;
            stream?: boolean | undefined;
            stop?: string | string[] | undefined;
            max_tokens?: number | undefined;
            presence_penalty?: number | undefined;
            frequency_penalty?: number | undefined;
            logit_bias?: Record<string, number> | undefined;
            user?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        systemMessage: string;
        modelPreset: {
            model: string;
            temperature?: number | undefined;
            top_p?: number | undefined;
            n?: number | undefined;
            stream?: boolean | undefined;
            stop?: string | string[] | undefined;
            max_tokens?: number | undefined;
            presence_penalty?: number | undefined;
            frequency_penalty?: number | undefined;
            logit_bias?: Record<string, number> | undefined;
            user?: string | undefined;
        };
    }, {
        name: string;
        systemMessage: string;
        modelPreset: {
            model: string;
            temperature?: number | undefined;
            top_p?: number | undefined;
            n?: number | undefined;
            stream?: boolean | undefined;
            stop?: string | string[] | undefined;
            max_tokens?: number | undefined;
            presence_penalty?: number | undefined;
            frequency_penalty?: number | undefined;
            logit_bias?: Record<string, number> | undefined;
            user?: string | undefined;
        };
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    systemMessages: {
        name: string;
        systemMessage: string;
        modelPreset: {
            model: string;
            temperature?: number | undefined;
            top_p?: number | undefined;
            n?: number | undefined;
            stream?: boolean | undefined;
            stop?: string | string[] | undefined;
            max_tokens?: number | undefined;
            presence_penalty?: number | undefined;
            frequency_penalty?: number | undefined;
            logit_bias?: Record<string, number> | undefined;
            user?: string | undefined;
        };
    }[];
}, {
    systemMessages: {
        name: string;
        systemMessage: string;
        modelPreset: {
            model: string;
            temperature?: number | undefined;
            top_p?: number | undefined;
            n?: number | undefined;
            stream?: boolean | undefined;
            stop?: string | string[] | undefined;
            max_tokens?: number | undefined;
            presence_penalty?: number | undefined;
            frequency_penalty?: number | undefined;
            logit_bias?: Record<string, number> | undefined;
            user?: string | undefined;
        };
    }[];
}>;
export type CreateChatCompletionRequestType = z.infer<typeof createChatCompletionRequestSchema>;
export type SystemMessageType = CreateChatCompletionRequestType['systemMessages'][number];
//# sourceMappingURL=CreateChatCompletionRequestSchema.d.ts.map