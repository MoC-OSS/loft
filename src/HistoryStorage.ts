import { Redis, Cluster } from 'ioredis';
import {
  ChatCompletionRequestMessage,
  ChatCompletionResponseMessage,
} from 'openai';
import { SystemMessageType } from './schema/CreateChatCompletionRequestSchema';

export interface SessionData {
  sessionId: string;
  modelPreset: SystemMessageType['modelPreset'];
  messages: ChatCompletionRequestMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export class HistoryStorage {
  private client: Redis | Cluster;
  private sessionTtl: number;

  constructor(client: Redis | Cluster, sessionTtl: number) {
    this.client = client;
    this.sessionTtl = sessionTtl;
  }

  private getSessionKey(sessionId: string): string {
    return `chat:${sessionId}`;
  }

  async isExists(sessionId: string): Promise<boolean> {
    const sessionKey = this.getSessionKey(sessionId);
    const result = await this.client.exists(sessionKey);
    return result === 1;
  }

  async createSession(
    sessionId: string,
    modelPreset: SessionData['modelPreset'],
    messages: ChatCompletionRequestMessage[],
  ): Promise<void> {
    const sessionKey = this.getSessionKey(sessionId);
    const sessionData: SessionData = {
      sessionId,
      modelPreset,
      messages,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.client.set(
      sessionKey,
      JSON.stringify(sessionData),
      'EX',
      this.sessionTtl,
    );
  }

  async updateMessages(
    sessionId: string,
    newMessage: ChatCompletionResponseMessage | ChatCompletionRequestMessage,
  ): Promise<void> {
    const sessionKey = this.getSessionKey(sessionId);
    const sessionData = await this.getSession(sessionId);
    sessionData.messages.push(newMessage);
    sessionData.updatedAt = new Date();
    await this.client.set(
      sessionKey,
      JSON.stringify(sessionData),
      'EX',
      this.sessionTtl,
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    const sessionKey = this.getSessionKey(sessionId);
    await this.client.del(sessionKey);
  }

  // async getMessages(
  //   sessionId: string,
  // ): Promise<ChatCompletionRequestMessage[]> {
  //   const sessionData = await this.getSession(sessionId);
  //   return sessionData.messages;
  // }

  async getSession(sessionId: string): Promise<SessionData> {
    const sessionKey = this.getSessionKey(sessionId);
    const sessionData = await this.client.get(sessionKey);
    if (!sessionData) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return JSON.parse(sessionData);
  }
}
