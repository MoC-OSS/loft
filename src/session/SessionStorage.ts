import { Redis, Cluster } from 'ioredis';
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
  ChatCompletionResponseMessage,
  ChatCompletionResponseMessageRoleEnum,
} from 'openai';
import { SessionData } from '../@types';
import { deepEqual } from '../helpers';
import { Session } from './Session';

export class SessionStorage {
  constructor(
    private readonly client: Redis | Cluster,
    private readonly sessionTtl: number,
    private readonly appName: string,
  ) {}

  private getChatCompletionSessionKey(
    sessionId: string,
    systemMessageName: string,
  ): string {
    return `app:${this.appName}:api_type:chat_completion:function:session_storage:session:${sessionId}:system_message:${systemMessageName}`;
  }

  async isExists(
    sessionId: string,
    systemMessageName: string,
  ): Promise<boolean> {
    const sessionKey = this.getChatCompletionSessionKey(
      sessionId,
      systemMessageName,
    );
    const result = await this.client.exists(sessionKey);
    return result === 1;
  }

  async createSession(
    sessionId: string,
    systemMessageName: string,
    modelPreset: SessionData['modelPreset'],
    message: ChatCompletionRequestMessage,
  ): Promise<void> {
    const sessionKey = this.getChatCompletionSessionKey(
      sessionId,
      systemMessageName,
    );
    const sessionData: SessionData = {
      sessionId,
      systemMessageName,
      modelPreset,
      messages: [message],
      lastMessageByRole: {
        user: null,
        assistant: null,
        system: message,
        function: null,
      },
      ctx: {},
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
    systemMessageName: string,
    newMessage: ChatCompletionResponseMessage | ChatCompletionRequestMessage,
  ): Promise<void> {
    try {
      const sessionKey = this.getChatCompletionSessionKey(
        sessionId,
        systemMessageName,
      );

      const sessionData = await this.getSession(sessionId, systemMessageName);
      sessionData.messages.push(newMessage);
      sessionData.updatedAt = new Date();

      if (newMessage.role === ChatCompletionResponseMessageRoleEnum.User)
        sessionData.lastMessageByRole.user = newMessage;
      if (newMessage.role === ChatCompletionResponseMessageRoleEnum.Assistant)
        sessionData.lastMessageByRole.assistant = newMessage;
      if (newMessage.role === ChatCompletionResponseMessageRoleEnum.System)
        sessionData.lastMessageByRole.system = newMessage;
      if (newMessage.role === ChatCompletionResponseMessageRoleEnum.Function)
        sessionData.lastMessageByRole.function = newMessage;

      await this.client.set(
        sessionKey,
        JSON.stringify(sessionData),
        'EX',
        this.sessionTtl,
      );
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async replaceLastUserMessage(
    sessionId: string,
    systemMessageName: string,
    newMessage: ChatCompletionResponseMessage | ChatCompletionRequestMessage,
    role: ChatCompletionRequestMessageRoleEnum = 'user',
  ) {
    const session = await this.getSession(sessionId, systemMessageName);
    if (session.messages[session.messages.length - 1].role === role) {
      session.updatedAt = new Date();
      session.messages[session.messages.length - 1].content =
        newMessage.content;
      const sessionKey = this.getChatCompletionSessionKey(
        sessionId,
        systemMessageName,
      );

      await this.client.set(
        sessionKey,
        JSON.stringify(session),
        'EX',
        this.sessionTtl,
      );
    } else {
      throw new Error("Last message isn't user role message");
    }
  }

  async deleteSession(
    sessionId: string,
    systemMessageName: string,
  ): Promise<void> {
    const sessionKey = this.getChatCompletionSessionKey(
      sessionId,
      systemMessageName,
    );
    await this.client.del(sessionKey);
  }

  async deleteSessionsById(sessionId: string) {
    const keys = await this.findKeysByPartialName(sessionId);
    await this.client.del(keys);
  }
  private async findKeysByPartialName(partialKey: string) {
    try {
      return this.client.keys(`*${partialKey}*`);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async saveCtx(
    sessionId: string,
    systemMessageName: string,
    ctx: Record<string, unknown>,
  ) {
    const session = await this.getSession(sessionId, systemMessageName);

    if (deepEqual(session.ctx, ctx)) return session; //skip if ctx is the same

    session.ctx = ctx;

    const sessionKey = this.getChatCompletionSessionKey(
      sessionId,
      systemMessageName,
    );
    await this.client.set(
      sessionKey,
      JSON.stringify(session),
      'EX',
      this.sessionTtl,
    );

    return this.getSession(sessionId, systemMessageName);
  }

  async getSession(
    sessionId: string,
    systemMessageName: string,
  ): Promise<SessionData> {
    const sessionKey = this.getChatCompletionSessionKey(
      sessionId,
      systemMessageName,
    );
    const sessionData = await this.client.get(sessionKey);
    if (!sessionData) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const SessionData = JSON.parse(sessionData) as SessionData;
    const session = new Session(this, SessionData);

    return session;
  }
}
