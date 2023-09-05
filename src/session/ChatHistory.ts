import { isNotUndefined } from '../helpers';
import { Message } from './Message';
import { QueryByArrayOfObjects } from './QueryByArrayOfInstance';
import { getLogger } from './../Logger';
import { Logger } from 'pino';
import { PalmMessage } from '../@types';

const logger = getLogger('ChatHistory');

const l = Symbol('logger');

export class ChatHistory extends QueryByArrayOfObjects<Message> {
  private readonly [l]: Logger; // this Symbol property for exclude logger from built-in Array methods of instance

  constructor(
    sessionId: string,
    systemMessageName: string,
    ...items: Message[]
  ) {
    super(...items.map((item) => new Message(item)));
    this[l] = logger.child({ sessionId, systemMessageName });
    this[l].info(`ChatHistory initialization...`);
  }

  append(message: Message): void {
    this[l].info(`append new message`);
    this.push(message);
  }

  // partial update by id
  updateById(id: string, newData: Partial<Message>): void {
    this[l].info(`update message with id: ${id}`);
    const index = this.findIndex((message) => message.id === id);
    if (index === -1) {
      throw new Error(`Message with id "${id}" not found`);
    }

    this[index] = new Message(Object.assign({}, this[index], newData));
  }

  archiveById(id: string): void {
    this[l].info(`archive message with id: ${id}`);
    this.updateById(id, { isArchived: true });
  }

  deleteById(id: string): void {
    this[l].info(`delete message by id: ${id}`);
    const index = this.findIndex((message) => message.id === id);
    if (index === -1) {
      throw new Error(`Message with id "${id}" not found`);
    }
    this.splice(index, 1);
  }

  appendAfterMessageId(message: Message, id: string): void {
    this[l].info(`append message after message by id: ${id}`);
    const index = this.findIndex((message) => message.id === id);
    if (index === -1) {
      throw new Error(`Message with id "${id}" not found`);
    }
    this.splice(index + 1, 0, message);
  }

  replaceById(id: string, message: Message): void {
    this[l].info(`replace message by id: ${id}`);
    const index = this.findIndex((message) => message.id === id);
    if (index === -1) {
      throw new Error(`Message with id "${id}" not found`);
    }
    this[index] = message;
  }

  replaceAll(messages: Message[]): ChatHistory {
    this[l].info(`replace all messages`);
    this.length = 0;
    this.push(...messages);
    return this;
  }

  public formatToLLM(): PalmMessage[] {
    this[l].info(`format messages to LLM format`);
    let messages = this.map((message) => message.formatToLLM()).filter(
      isNotUndefined,
    );

    return messages;
  }
}
