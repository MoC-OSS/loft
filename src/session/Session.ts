import { SessionProps } from './../@types';
import { SessionStorage } from './SessionStorage';
import {
  PalmExamples,
  SystemMessageType,
} from '../schema/CreateChatCompletionRequestSchema';
import { ChatHistory } from './ChatHistory';
import { getLogger } from './../Logger';
import { Message } from './Message';
import { ContextRecord } from '../schema/ChatCompletionSchema';

const l = getLogger('Session');

export class Session implements SessionProps {
  readonly sessionId: string;
  readonly systemMessageName: string;
  readonly systemMessage: string;
  readonly model: string;
  readonly modelPreset: SystemMessageType['modelPreset'];
  messages: ChatHistory;
  readonly examples: PalmExamples;
  lastMessageByRole: {
    user: Message | null;
    assistant: Message | null;
  };
  handlersCount: Record<string, number>;
  public ctx: ContextRecord;
  messageAccumulator: Message[] | null;
  readonly createdAt: number;
  updatedAt: number;
  lastError: string | null;

  constructor(
    private readonly sessionStorage: SessionStorage,
    sessionData: SessionProps,
  ) {
    this.sessionId = sessionData.sessionId;
    this.systemMessageName = sessionData.systemMessageName;
    this.systemMessage = sessionData.systemMessage;

    l.info(`${this.logPrefix()} Session initialization...`);

    this.model = sessionData.model;
    this.modelPreset = sessionData.modelPreset;
    this.messages = new ChatHistory(
      sessionData.sessionId,
      sessionData.systemMessageName,
      ...sessionData.messages,
    );
    this.examples = sessionData.examples;
    this.lastMessageByRole = sessionData.lastMessageByRole;
    this.handlersCount = sessionData.handlersCount;
    this.ctx = sessionData.ctx;
    this.messageAccumulator = sessionData.messageAccumulator || null;
    this.createdAt = sessionData.createdAt;
    this.updatedAt = sessionData.updatedAt;
    this.lastError = sessionData.lastError;
  }

  private logPrefix(): string {
    return `sessionId: ${this.sessionId}, systemMessageName: ${this.systemMessageName} -`;
  }

  public async save(): Promise<Session> {
    l.info(`${this.logPrefix()} - save session`);
    return this.sessionStorage.save(this);
  }

  public async delete(): Promise<void> {
    l.info(`${this.logPrefix()} - delete session`);
    this.sessionStorage.deleteSession(this.sessionId, this.systemMessageName);
  }

  public toJSON(): SessionProps {
    return {
      sessionId: this.sessionId,
      systemMessageName: this.systemMessageName,
      systemMessage: this.systemMessage,
      model: this.model,
      modelPreset: this.modelPreset,
      messages: this.messages,
      examples: this.examples,
      lastMessageByRole: this.lastMessageByRole,
      handlersCount: this.handlersCount,
      ctx: this.ctx,
      messageAccumulator: this.messageAccumulator,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastError: this.lastError,
    };
  }
}
