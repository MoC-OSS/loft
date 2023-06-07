"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatCompletionInputSchema = void 0;
const zod_1 = require("zod");
exports.chatCompletionInputSchema = zod_1.z.object({
    botName: zod_1.z.string(),
    message: zod_1.z.string(),
    chatId: zod_1.z.string(),
    intent: zod_1.z.string(),
});
