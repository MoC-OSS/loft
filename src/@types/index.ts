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
  systemMessageDb: number;
  historyDb: number;
  openAiKey: string;
  s3BucketName: string;
  awsRegion: string;
  botName: string;
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
