import { SessionData } from './../@types';
import { SessionStorage } from './SessionStorage';
import {
  ChatCompletionRequestMessage,
  ChatCompletionResponseMessage,
} from 'openai';
import { SystemMessageType } from '../schema/CreateChatCompletionRequestSchema';

export class Session implements SessionData {
  readonly sessionId: string;
  readonly systemMessageName: string;
  readonly modelPreset: SystemMessageType['modelPreset'];
  readonly messages: ChatCompletionRequestMessage[];
  readonly lastMessageByRole: {
    user: ChatCompletionRequestMessage | null;
    assistant: ChatCompletionResponseMessage | null;
    system: ChatCompletionResponseMessage | null;
    function: ChatCompletionResponseMessage | null;
  };
  public ctx: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  constructor(
    private readonly sessionStorage: SessionStorage,
    sessionData: SessionData,
  ) {
    this.sessionId = sessionData.sessionId;
    this.systemMessageName = sessionData.systemMessageName;
    this.modelPreset = sessionData.modelPreset;
    this.messages = sessionData.messages;
    this.lastMessageByRole = sessionData.lastMessageByRole;
    this.ctx = sessionData.ctx;
    this.createdAt = sessionData.createdAt;
    this.updatedAt = sessionData.updatedAt;
  }

  public async saveCtx(): Promise<void> {
    this.sessionStorage.saveCtx(
      this.sessionId,
      this.systemMessageName,
      this.ctx,
    );
  }

  public async delete(): Promise<void> {
    this.sessionStorage.deleteSession(this.sessionId, this.systemMessageName);
  }
}
