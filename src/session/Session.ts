import { SessionData } from './../@types';
import { SessionStorage } from './SessionStorage';
import {
  ChatCompletionRequestMessage,
  ChatCompletionResponseMessage,
} from 'openai';
import { SystemMessageType } from '../schema/CreateChatCompletionRequestSchema';
import { ChatHistory } from './ChatHistory';

export class Session implements SessionData {
  readonly sessionId: string;
  readonly systemMessageName: string;
  readonly modelPreset: SystemMessageType['modelPreset'];
  messages: ChatHistory;
  lastMessageByRole: {
    user: ChatCompletionRequestMessage | null;
    assistant: ChatCompletionResponseMessage | null;
    system: ChatCompletionResponseMessage | null;
    function: ChatCompletionResponseMessage | null;
  };
  handlersCount: Record<string, number>;
  public ctx: Record<string, unknown>;
  readonly createdAt: number;
  updatedAt: number;

  constructor(
    private readonly sessionStorage: SessionStorage,
    sessionData: SessionData,
  ) {
    this.sessionId = sessionData.sessionId;
    this.systemMessageName = sessionData.systemMessageName;
    this.modelPreset = sessionData.modelPreset;
    this.messages = new ChatHistory(
      this.sessionStorage,
      ...sessionData.messages,
    );
    this.lastMessageByRole = sessionData.lastMessageByRole;
    this.handlersCount = sessionData.handlersCount;
    this.ctx = sessionData.ctx;
    this.createdAt = sessionData.createdAt;
    this.updatedAt = sessionData.updatedAt;
  }

  public async saveCtx(): Promise<Session> {
    return this.sessionStorage.saveCtx(
      this.sessionId,
      this.systemMessageName,
      this.ctx,
    );
  }

  public async saveMessages(): Promise<Session> {
    return this.sessionStorage.updateAllMessages(
      this.sessionId,
      this.systemMessageName,
      this.messages,
    );
  }

  public async delete(): Promise<void> {
    this.sessionStorage.deleteSession(this.sessionId, this.systemMessageName);
  }

  public toJSON(): SessionData {
    return {
      sessionId: this.sessionId,
      systemMessageName: this.systemMessageName,
      modelPreset: this.modelPreset,
      messages: this.messages,
      lastMessageByRole: this.lastMessageByRole,
      handlersCount: this.handlersCount,
      ctx: this.ctx,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
