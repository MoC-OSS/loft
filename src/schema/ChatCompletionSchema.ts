import { ZodType, z } from 'zod';
import { redisKeyRegex } from '../helpers';

// Define a recursive schema for values
export const recursiveValueSchema: ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.record(recursiveValueSchema),
  ]),
);

// Define a schema for the entire record
export const recordSchema: ZodType<Record<string, unknown>> =
  z.record(recursiveValueSchema);

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
  ctx: recordSchema.optional(),
});

export type InputPayload = z.infer<typeof ChatCompletionInputSchema>;
export type ContextRecord = z.infer<typeof recordSchema>;
