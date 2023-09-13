"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChatCompletionRequestSchema = void 0;
const zod_1 = require("zod");
const helpers_1 = require("../helpers");
const ModelPresetSchema = zod_1.z.object({
    temperature: zod_1.z.number(),
    maxOutputTokens: zod_1.z.number(),
    topP: zod_1.z.number(),
    topK: zod_1.z.number(),
});
const ExampleSchema = zod_1.z.object({
    input: zod_1.z.object({
        content: zod_1.z.string(),
    }),
    output: zod_1.z.object({
        content: zod_1.z.string(),
    }),
});
const SystemMessageSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .refine((name) => helpers_1.redisKeyRegex.test(name), 'Invalid systemMessages.name value. Allowed only alphanumeric characters (a-z, A-Z, 0-9) and the specified symbols (: . - _)'),
    systemMessage: zod_1.z.string(),
    examples: zod_1.z.array(ExampleSchema).optional(),
    model: zod_1.z.string(),
    modelPreset: ModelPresetSchema,
});
exports.createChatCompletionRequestSchema = zod_1.z
    .object({
    systemMessages: zod_1.z.array(SystemMessageSchema),
})
    .strict();
