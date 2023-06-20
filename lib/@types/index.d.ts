import { ChatCompletionRequestMessage, CreateChatCompletionResponse } from 'openai';
import { SystemMessageType } from '../schema/CreateChatCompletionRequestSchema';
import { PromptType } from '../schema/PromptSchema';
export interface SessionData {
    sessionId: string;
    modelPreset: SystemMessageType['modelPreset'];
    messages: ChatCompletionRequestMessage[];
    createdAt: Date;
    updatedAt: Date;
}
export interface InputData {
    systemMessage: string;
    message: string;
    chatId: string;
    intent?: string;
}
export interface InputContext {
    message: string;
    sessionId: string;
}
export interface OutputContext {
    session: SessionData;
    llmResponse?: CreateChatCompletionResponse;
}
export type IOContext = InputContext | OutputContext;
export interface Config {
    nodeEnv: string;
    redisHost: string;
    redisPort: number;
    bullMqDb: number;
    openAiKey: string;
    openAiRateLimiter: {
        /**
         * Max number of jobs to process in the time period
         * specified in `duration`.
         */
        max: number;
        /**
         * Time in milliseconds. During this time, a maximum
         * of `max` jobs will be processed.
         */
        duration: number;
        /**
         * Amount of jobs that a single worker is allowed to work on
         * in parallel.
         *
         * @default 1
         * @see {@link https://docs.bullmq.io/guide/workers/concurrency}
         */
        concurrency: number;
    };
}
export declare enum MiddlewareStatus {
    CONTINUE = "CONTINUE",
    CALL_AGAIN = "CALL_AGAIN",
    NOT_RETURNED = "NOT_RETURNED",
    STOP = "STOP"
}
export type AsyncLLMInputMiddleware = (context: InputContext, next: (input: InputContext) => Promise<void>) => Promise<void>;
export type AsyncLLMOutputMiddleware = (context: OutputContext, next: (output: OutputContext) => Promise<void>) => Promise<{
    status?: MiddlewareStatus;
    newOutputContext: OutputContext | undefined;
}>;
export type LLMInputMiddlewares = Map<string, AsyncLLMInputMiddleware>;
export type LLMOutputMiddlewares = Map<string, AsyncLLMOutputMiddleware>;
export type SystemMessageComputer = (input: SystemMessageType, context: InputData) => Promise<SystemMessageType>;
export type SystemMessageComputers = Map<string, SystemMessageComputer>;
export type PromptComputer = (input: PromptType, context: SessionData) => Promise<PromptType>;
export type PromptComputers = Map<string, PromptComputer>;
//# sourceMappingURL=index.d.ts.map