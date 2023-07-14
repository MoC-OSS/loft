import { z } from 'zod';
export declare const ChatCompletionInputSchema: z.ZodObject<{
    systemMessageName: z.ZodEffects<z.ZodString, string, string>;
    message: z.ZodString;
    sessionId: z.ZodEffects<z.ZodString, string, string>;
    intent: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    sessionId: string;
    systemMessageName: string;
    intent: string;
}, {
    message: string;
    sessionId: string;
    systemMessageName: string;
    intent: string;
}>;
//# sourceMappingURL=ChatCompletionSchema.d.ts.map