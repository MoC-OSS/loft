import { z } from 'zod';

export const ChatCompletionInputSchema = z.object({
  systemMessage: z.string(),
  message: z.string(),
  chatId: z.string(),
  intent: z.string(),
});
