"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptSchema = void 0;
const zod_1 = require("zod");
exports.PromptSchema = zod_1.z.object({
    prompts: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        prompt: zod_1.z.string(),
    })),
});
