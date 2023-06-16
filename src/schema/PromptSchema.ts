import { z } from 'zod';

export const PromptSchema = z.object({
  prompts: z.array(
    z.object({
      name: z.string(),
      prompt: z.string(),
    }),
  ),
});

export type PromptsFileType = z.infer<typeof PromptSchema>;

export type PromptType = PromptsFileType['prompts'][number];
