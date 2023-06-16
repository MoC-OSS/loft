import { z } from 'zod';
export declare const ChatCompletionInputSchema: z.ZodObject<{
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
//# sourceMappingURL=ChatCompletionSchema.d.ts.map