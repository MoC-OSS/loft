import { z } from 'zod';
export declare const ChatCompletionInputSchema: z.ZodObject<{
    systemMessageName: z.ZodEffects<z.ZodString, string, string>;
    message: z.ZodString;
    sessionId: z.ZodString;
    intent: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    systemMessageName: string;
    sessionId: string;
    intent: string;
}, {
    message: string;
    systemMessageName: string;
    sessionId: string;
    intent: string;
}>;
//# sourceMappingURL=ChatCompletionSchema.d.ts.map