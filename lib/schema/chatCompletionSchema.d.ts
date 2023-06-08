import { z } from 'zod';
export declare const chatCompletionInputSchema: z.ZodObject<{
    systemMessage: z.ZodString;
    message: z.ZodString;
    chatId: z.ZodString;
    intent: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    systemMessage: string;
    chatId: string;
    intent: string;
}, {
    message: string;
    systemMessage: string;
    chatId: string;
    intent: string;
}>;
//# sourceMappingURL=chatCompletionSchema.d.ts.map