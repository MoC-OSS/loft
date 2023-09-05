import { SystemMessageType } from '../schema/CreateChatCompletionRequestSchema';
import { PromptType } from '../schema/PromptSchema';
import { Session } from '../session/Session';
import { ChatCompletionCallInitiator } from '../ChatCompletion';
import { ChatHistory } from '../session/ChatHistory';
import { Message } from '../session/Message';
export type PalmExample = {
    input: {
        content: string;
    };
    output: {
        content: string;
    };
};
export interface SessionProps {
    sessionId: string;
    systemMessageName: string;
    systemMessage: string;
    modelPreset: SystemMessageType['modelPreset'];
    messages: ChatHistory;
    examples: PalmExample[];
    model: string;
    lastMessageByRole: {
        user: Message | null;
        assistant: Message | null;
    };
    handlersCount: Record<string, number>;
    ctx: Record<string, unknown>;
    messageAccumulator: Message[] | null;
    createdAt: number;
    updatedAt: number;
    lastError: string | null;
}
export interface InputPayload {
    sessionId: string;
    systemMessageName: string;
    message: string;
}
export interface ChatInputPayload {
    sessionId: string;
    systemMessageName: string;
    messages: Message[];
}
export interface OutputContext {
    initiator: ChatCompletionCallInitiator;
    session: Session;
    llmResponse?: PredictionResponse['predictions'][number];
}
export type IOContext = ChatInputPayload | OutputContext;
export interface Config {
    nodeEnv: string;
    appName: string;
    redisHost: string;
    redisPort: number;
    bullMqDb: number;
    llmRateLimiter: {
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
export type SystemMessageComputer = (input: SystemMessageType, context: ChatInputPayload) => Promise<SystemMessageType>;
export type SystemMessageComputers = Map<string, SystemMessageComputer>;
export type PromptComputer = (input: PromptType, context: Session) => Promise<PromptType>;
export type PromptComputers = Map<string, PromptComputer>;
export type ErrorProperties = Partial<OutputContext> | {
    initiator: ChatCompletionCallInitiator;
    sessionId: Session['sessionId'];
    systemMessageName: Session['systemMessageName'];
    messages: Message[];
} | undefined;
export type ErrorHandler = (error: Error | unknown, response?: ErrorProperties) => Promise<void>;
import { protos } from '@google-ai/generativelanguage';
import { PredictionResponse } from '../llm/Palm/@types/response';
export type IGenerateMessageResponse = protos.google.ai.generativelanguage.v1beta2.IGenerateMessageResponse;
export type IGenerateMessageRequest = protos.google.ai.generativelanguage.v1beta2.IGenerateMessageRequest;
export type IMessagePrompt = protos.google.ai.generativelanguage.v1beta2.IMessagePrompt;
export type PalmMessage = protos.google.ai.generativelanguage.v1beta2.IMessage;
//# sourceMappingURL=index.d.ts.map