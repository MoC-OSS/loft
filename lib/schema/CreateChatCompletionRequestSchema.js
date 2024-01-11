"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChatCompletionRequestSchema = exports.ChatCompletionFunctions = void 0;
const zod_1 = require("zod");
const helpers_1 = require("../helpers");
exports.ChatCompletionFunctions = zod_1.z.object({
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    parameters: zod_1.z.record(zod_1.z.any()).optional(),
});
const CreateChatCompletionRequestFunctionCallOneOf = zod_1.z.object({
    name: zod_1.z.string(),
});
const CreateChatCompletionRequestFunctionCall = zod_1.z.union([
    CreateChatCompletionRequestFunctionCallOneOf,
    zod_1.z.string(),
]);
exports.createChatCompletionRequestSchema = zod_1.z
    .object({
    systemMessages: zod_1.z.array(zod_1.z.object({
        name: zod_1.z
            .string()
            .refine((name) => helpers_1.redisKeyRegex.test(name), 'Invalid systemMessages.name value. Allowed only alphanumeric characters (a-z, A-Z, 0-9) and the specified symbols (: . - _)'),
        systemMessage: zod_1.z.string(),
        // must be equal to the CreateChatCompletionRequest type from the OpenAI client library
        modelPreset: zod_1.z.object({
            model: zod_1.z
                .string()
                .describe('ID of the model to use. Currently, only `gpt-3.5-turbo` and `gpt-3.5-turbo-0301` are supported.'),
            functions: zod_1.z.array(exports.ChatCompletionFunctions).optional(),
            function_call: CreateChatCompletionRequestFunctionCall.optional(), // function_call: "none" will force the model to generate a user-facing message.
            temperature: zod_1.z
                .number()
                .optional()
                .describe('What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.  We generally recommend altering this or `top_p` but not both.'),
            top_p: zod_1.z
                .number()
                .optional()
                .describe('An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.  We generally recommend altering this or `temperature` but not both.'),
            n: zod_1.z
                .number()
                .optional()
                .describe('How many chat completion choices to generate for each input message.'),
            stream: zod_1.z
                .boolean()
                .optional()
                .describe('If set, partial message deltas will be sent, like in ChatGPT. Tokens will be sent as data-only [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format) as they become available, with the stream terminated by a `data: [DONE]` message.'),
            stop: zod_1.z
                .array(zod_1.z.string())
                .length(4)
                .optional()
                .or(zod_1.z.string())
                .optional()
                .describe('type CreateChatCompletionRequestStop * Up to 4 sequences where the API will stop generating further tokens.'),
            max_tokens: zod_1.z
                .number()
                .optional()
                .describe("Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.  [See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)"),
            presence_penalty: zod_1.z
                .number()
                .optional()
                .describe("Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.  [See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)"),
            frequency_penalty: zod_1.z
                .number()
                .optional()
                .describe("Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.  [See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)"),
            logit_bias: zod_1.z
                .record(zod_1.z.number())
                .refine((data) => {
                return Object.keys(data).every((k) => !isNaN(+k));
            }, {
                message: 'All keys must be numbers',
            })
                .optional()
                .describe('Modify the likelihood of specified tokens appearing in the completion.  Accepts a json object that maps tokens (specified by their token ID in the tokenizer) to an associated bias value from -100 to 100. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token.'),
            // user should be provided into code instead of S3 file
            // user: z
            //   .string()
            //   .optional()
            //   .describe(
            //     'A unique identifier representing your end-user, which can help OpenAI to monitor and detect abuse. [Learn more](/docs/guides/safety-best-practices/end-user-ids).',
            //   ),
        }),
    })),
})
    .strict(); // forbid additional properties
