import { z } from 'zod';
export declare const chatCompletionInputSchema: z.ZodObject<{
    botName: z.ZodString;
    message: z.ZodString;
    chatId: z.ZodString;
    intent: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    botName: string;
    chatId: string;
    intent: string;
}, {
    message: string;
    botName: string;
    chatId: string;
    intent: string;
}>;
//# sourceMappingURL=chatCompletionSchema.d.ts.map