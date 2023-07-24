import { Redis, Cluster } from 'ioredis';
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
  ChatCompletionResponseMessage,
} from 'openai';
import { SessionData } from '../@types';
import { deepEqual, getTimestamp } from '../helpers';
import { Session } from './Session';
import { ChatHistory } from './ChatHistory';
import { Message } from './Message';

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
    message: Message,
  ): Promise<void> {
    const sessionKey = this.getChatCompletionSessionKey(
      sessionId,
      systemMessageName,
    );
    const timestamp = getTimestamp();
    const session = new Session(this, {
      sessionId,
      systemMessageName,
      modelPreset,
      messages: new ChatHistory(this, message),
      lastMessageByRole: {
        user: null,
        assistant: null,
        system: message,
        function: null,
      },
      handlersCount: {},
      ctx: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await this.client.set(
      sessionKey,
      JSON.stringify(session),
      'EX',
      this.sessionTtl,
    );
  }

  async appendMessages(
    sessionId: string,
    systemMessageName: string,
    newMessages: Message[],
  ): Promise<void> {
    try {
      const session = await this.getSession(sessionId, systemMessageName);

      newMessages.forEach((newMessage) => {
        session.messages.push(newMessage);

        session.lastMessageByRole[newMessage.role] = newMessage;
      });
      session.updatedAt = getTimestamp();

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
      session.updatedAt = getTimestamp();
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

  async incrementHandlerCount(
    sessionId: string,
    systemMessageName: string,
    handlerName: string,
  ) {
    const session = await this.getSession(sessionId, systemMessageName);
    if (!session.handlersCount[handlerName]) {
      session.handlersCount[handlerName] = 0;
    }
    session.handlersCount[handlerName] += 1;
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
  }

  async save(session: Session): Promise<Session> {
    const existingSession = await this.getSession(
      session.sessionId,
      session.systemMessageName,
    );

    if (
      deepEqual(existingSession.ctx, session.ctx) &&
      deepEqual(existingSession.messages, session.messages)
    ) {
      return existingSession;
    }

    existingSession.messages.length = 0;
    session.messages.forEach((message) => {
      existingSession.messages.push(message);
      existingSession.lastMessageByRole[message.role] = message;
    });

    existingSession.ctx = session.ctx;
    existingSession.updatedAt = getTimestamp();

    const sessionKey = this.getChatCompletionSessionKey(
      session.sessionId,
      session.systemMessageName,
    );
    await this.client.set(
      sessionKey,
      JSON.stringify(existingSession),
      'EX',
      this.sessionTtl,
    );

    return this.getSession(session.sessionId, session.systemMessageName);
  }

  async getSession(
    sessionId: string,
    systemMessageName: string,
  ): Promise<Session> {
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
