import { z } from 'zod';
export declare const PromptSchema: z.ZodObject<{
    prompts: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        prompt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        prompt: string;
    }, {
        name: string;
        prompt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    prompts: {
        name: string;
        prompt: string;
    }[];
}, {
    prompts: {
        name: string;
        prompt: string;
    }[];
}>;
export type PromptsFileType = z.infer<typeof PromptSchema>;
export type PromptType = PromptsFileType['prompts'][number];
//# sourceMappingURL=PromptSchema.d.ts.map