import { z } from 'zod';
export declare const ChatCompletionInputSchema: z.ZodObject<{
    systemMessageName: z.ZodEffects<z.ZodString, string, string>;
    message: z.ZodString;
    sessionId: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    message: string;
    sessionId: string;
    systemMessageName: string;
}, {
    message: string;
    sessionId: string;
    systemMessageName: string;
}>;
//# sourceMappingURL=ChatCompletionSchema.d.ts.map