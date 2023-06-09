import { SystemMessageType } from '../schema/CreateChatCompletionRequestSchema';

export interface InputData {
  botName: string;
  message: string;
  chatId: string;
  intent: string;
}

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

export type AsyncLLMMiddleware = (
  input: string,
  next: (input: string) => Promise<void>,
) => Promise<void>;
export type LLMMiddlewares = Map<string, AsyncLLMMiddleware>;

export type SystemMessageComputer = (
  input: SystemMessageType,
) => Promise<SystemMessageType>;
export type SystemMessageComputers = Map<string, SystemMessageComputer>;
