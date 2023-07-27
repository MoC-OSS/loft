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
import { getLogger } from './../Logger';

const l = getLogger('SessionStorage');

export class SessionStorage {
  constructor(
    private readonly client: Redis | Cluster,
    private readonly sessionTtl: number,
    private readonly appName: string,
  ) {
    l.info('SessionStorage initialization...');
  }

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
    l.info(`Check session exists by key: ${sessionKey}`);
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
    l.info(`Create session by key: ${sessionKey}`);
    const timestamp = getTimestamp();
    const session = new Session(this, {
      sessionId,
      systemMessageName,
      modelPreset,
      messages: new ChatHistory(sessionId, systemMessageName, message),
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
      l.info(
        `Append messages to session ${sessionId}, systemMessageName: ${systemMessageName}`,
      );

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
      l.error(error);
      throw error;
    }
  }

  async replaceLastUserMessage(
    sessionId: string,
    systemMessageName: string,
    newMessage: ChatCompletionResponseMessage | ChatCompletionRequestMessage,
    role: ChatCompletionRequestMessageRoleEnum = 'user',
  ) {
    l.info(
      `Replace last user message in session ${sessionId}, systemMessageName: ${systemMessageName}`,
    );

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
    l.info(`Delete session by key: ${sessionKey}`);

    await this.client.del(sessionKey);
  }

  async deleteSessionsById(sessionId: string) {
    l.info(`Delete sessions by id: ${sessionId}`);
    const keys = await this.findKeysByPartialName(sessionId);
    await this.client.del(keys);
  }
  private async findKeysByPartialName(partialKey: string) {
    try {
      l.info(`Find keys by partial name: ${partialKey}`);
      return this.client.keys(`*${partialKey}*`);
    } catch (error) {
      l.error(error);
      throw error;
    }
  }

  async incrementHandlerCount(
    sessionId: string,
    systemMessageName: string,
    handlerName: string,
  ) {
    l.info(
      `Increment handler count: ${handlerName}, sessionId: ${sessionId}, systemMessageName: ${systemMessageName}`,
    );
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
    l.info(
      `Save session: ${session.sessionId}, systemMessageName: ${session.systemMessageName}`,
    );
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
    l.info(
      `Get session: ${sessionId}, systemMessageName: ${systemMessageName}`,
    );
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
