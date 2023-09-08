"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatCompletionInputSchema = void 0;
const zod_1 = require("zod");
const helpers_1 = require("../helpers");
exports.ChatCompletionInputSchema = zod_1.z.object({
    systemMessageName: zod_1.z
        .string()
        .refine((name) => helpers_1.redisKeyRegex.test(name), 'Invalid systemMessages.name value. Allowed only alphanumeric characters (a-z, A-Z, 0-9) and the specified symbols (: . - _)'),
    message: zod_1.z.string(),
    sessionId: zod_1.z
        .string()
        .refine((name) => helpers_1.redisKeyRegex.test(name), 'Invalid systemMessages.name value. Allowed only alphanumeric characters (a-z, A-Z, 0-9) and the specified symbols (: . - _)'),
});
