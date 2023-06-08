import { z } from 'zod';

export const chatCompletionInputSchema = z.object({
  systemMessage: z.string(),
  message: z.string(),
  chatId: z.string(),
  intent: z.string(),
});
