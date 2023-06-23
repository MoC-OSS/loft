import { z } from 'zod';
export declare const ChatCompletionInputSchema: z.ZodObject<{
    systemMessageName: z.ZodString;
    message: z.ZodString;
    sessionId: z.ZodString;
    intent: z.ZodString;
}, "strip", z.ZodTypeAny, {
    systemMessageName: string;
    message: string;
    sessionId: string;
    intent: string;
}, {
    systemMessageName: string;
    message: string;
    sessionId: string;
    intent: string;
}>;
//# sourceMappingURL=ChatCompletionSchema.d.ts.map