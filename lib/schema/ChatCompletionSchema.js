"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatCompletionInputSchema = exports.recordSchema = exports.recursiveValueSchema = void 0;
const zod_1 = require("zod");
const helpers_1 = require("../helpers");
// Define a recursive schema for values
exports.recursiveValueSchema = zod_1.z.lazy(() => zod_1.z.union([
    zod_1.z.string(),
    zod_1.z.number(),
    zod_1.z.boolean(),
    zod_1.z.record(exports.recursiveValueSchema),
]));
// Define a schema for the entire record
exports.recordSchema = zod_1.z.record(exports.recursiveValueSchema);
exports.ChatCompletionInputSchema = zod_1.z.object({
    systemMessageName: zod_1.z
        .string()
        .refine((name) => helpers_1.redisKeyRegex.test(name), 'Invalid systemMessages.name value. Allowed only alphanumeric characters (a-z, A-Z, 0-9) and the specified symbols (: . - _)'),
    message: zod_1.z.string(),
    sessionId: zod_1.z
        .string()
        .refine((name) => helpers_1.redisKeyRegex.test(name), 'Invalid systemMessages.name value. Allowed only alphanumeric characters (a-z, A-Z, 0-9) and the specified symbols (: . - _)'),
    ctx: exports.recordSchema.optional(),
});
