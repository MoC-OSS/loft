"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatCompletionInputSchema = void 0;
const zod_1 = require("zod");
exports.ChatCompletionInputSchema = zod_1.z.object({
    systemMessageName: zod_1.z.string(),
    message: zod_1.z.string(),
    sessionId: zod_1.z.string(),
    intent: zod_1.z.string(),
});
