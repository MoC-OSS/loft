import { ZodType, z } from 'zod';
export declare const recursiveValueSchema: ZodType<unknown>;
export declare const recordSchema: ZodType<Record<string, unknown>>;
export declare const ChatCompletionInputSchema: z.ZodObject<{
    systemMessageName: z.ZodEffects<z.ZodString, string, string>;
    message: z.ZodString;
    sessionId: z.ZodEffects<z.ZodString, string, string>;
    ctx: z.ZodOptional<ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    sessionId: string;
    systemMessageName: string;
    ctx?: Record<string, unknown> | undefined;
}, {
    message: string;
    sessionId: string;
    systemMessageName: string;
    ctx?: Record<string, unknown> | undefined;
}>;
export type InputPayload = z.infer<typeof ChatCompletionInputSchema>;
export type ContextRecord = z.infer<typeof recordSchema>;
//# sourceMappingURL=ChatCompletionSchema.d.ts.map