import { ChatCompletionRequestMessage, ChatCompletionResponseMessage, CreateChatCompletionResponse } from 'openai';
import { SystemMessageType } from '../schema/CreateChatCompletionRequestSchema';
import { PromptType } from '../schema/PromptSchema';
import { Session } from '../session/Session';
import { ChatCompletionCallInitiator } from '../ChatCompletion';
import { ChatHistory } from '../session/ChatHistory';
import { Message } from '../session/Message';
export interface ChatCompletionMessage extends ChatCompletionRequestMessage, ChatCompletionResponseMessage {
}
export interface SessionProps {
    sessionId: string;
    systemMessageName: string;
    modelPreset: SystemMessageType['modelPreset'];
    messages: ChatHistory;
    lastMessageByRole: {
        user: ChatCompletionRequestMessage | null;
        assistant: ChatCompletionResponseMessage | null;
        system: ChatCompletionResponseMessage | null;
        function: ChatCompletionResponseMessage | null;
    };
    handlersCount: Record<string, number>;
    ctx: Record<string, unknown>;
    messageAccumulator: Message[] | null;
    createdAt: number;
    updatedAt: number;
    lastError: string | null;
}
export interface InputPayload {
    systemMessageName: string;
    messages: Message | Message[];
    sessionId: string;
}
export interface ChatInputPayload {
    sessionId: string;
    systemMessageName: string;
    messages: Message[];
}
export interface OutputContext {
    initiator: ChatCompletionCallInitiator;
    session: Session;
    llmResponse?: CreateChatCompletionResponse;
}
export type IOContext = ChatInputPayload | OutputContext;
export interface Config {
    nodeEnv: string;
    appName: string;
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
    jobsLockDuration: number;
    jobsAttempts: number;
    chatCompletionJobCallAttempts: number;
}
export declare enum MiddlewareStatus {
    CONTINUE = "CONTINUE",
    CALL_AGAIN = "CALL_AGAIN",
    NOT_RETURNED = "NOT_RETURNED",
    STOP = "STOP"
}
export type AsyncLLMInputMiddleware = (context: ChatInputPayload, next: (input: ChatInputPayload) => Promise<void>) => Promise<void>;
export type AsyncLLMOutputMiddleware = (context: OutputContext, next: (output: OutputContext) => Promise<void>) => Promise<{
    status?: MiddlewareStatus;
    newOutputContext: OutputContext | undefined;
}>;
export type LLMInputMiddlewares = Map<string, AsyncLLMInputMiddleware>;
export type LLMOutputMiddlewares = Map<string, AsyncLLMOutputMiddleware>;
export type SystemMessageComputer = (input: SystemMessageType, context: InputPayload) => Promise<SystemMessageType>;
export type SystemMessageComputers = Map<string, SystemMessageComputer>;
export type PromptComputer = (input: PromptType, context: SessionProps) => Promise<PromptType>;
export type PromptComputers = Map<string, PromptComputer>;
//# sourceMappingURL=index.d.ts.map