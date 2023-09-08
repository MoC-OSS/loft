import { z } from 'zod';
import { redisKeyRegex } from '../helpers';

export const ChatCompletionInputSchema = z.object({
  systemMessageName: z
    .string()
    .refine(
      (name) => redisKeyRegex.test(name),
      'Invalid systemMessages.name value. Allowed only alphanumeric characters (a-z, A-Z, 0-9) and the specified symbols (: . - _)',
    ),
  message: z.string(),
  sessionId: z
    .string()
    .refine(
      (name) => redisKeyRegex.test(name),
      'Invalid systemMessages.name value. Allowed only alphanumeric characters (a-z, A-Z, 0-9) and the specified symbols (: . - _)',
    ),
});
