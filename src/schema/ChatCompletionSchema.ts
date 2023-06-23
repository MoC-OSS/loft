import { z } from 'zod';

export const ChatCompletionInputSchema = z.object({
  systemMessageName: z.string(),
  message: z.string(),
  sessionId: z.string(),
  intent: z.string(),
});
