import { ChatCompletionMessage } from '../@types';
import { isNotUndefined } from '../helpers';
import { Message } from './Message';
import { QueryByArrayOfObjects } from './QueryByArrayOfInstance';
import { getLogger } from './../Logger';

const l = getLogger('ChatHistory');

export class ChatHistory extends QueryByArrayOfObjects<Message> {
  constructor(
    private readonly sessionId: string,
    private readonly systemMessageName: string,
    ...items: Message[]
  ) {
    super(...items.map((item) => new Message(item)));
    l.info(`${this.logPrefix()} - ChatHistory initialization...`);
  }

  private logPrefix(): string {
    return `sessionId: ${this.sessionId}, systemMessageName: ${this.systemMessageName} -`;
  }

  append(message: Message): void {
    l.info(`${this.logPrefix()}  append new message`);
    this.push(message);
  }

  // partial update by id
  updateById(id: string, newData: Partial<Message>): void {
    l.info(`${this.logPrefix()} update message with id: ${id}`);
    const index = this.findIndex((message) => message.id === id);
    if (index === -1) {
      throw new Error(`Message with id "${id}" not found`);
    }
    this[index] = new Message({ ...this[index], ...newData });
  }

  archiveById(id: string): void {
    l.info(`${this.logPrefix()} archive message with id: ${id}`);
    this.updateById(id, { isArchived: true });
  }

  deleteById(id: string): void {
    l.info(`${this.logPrefix()} delete message by id: ${id}`);
    const index = this.findIndex((message) => message.id === id);
    if (index === -1) {
      throw new Error(`Message with id "${id}" not found`);
    }
    this.splice(index, 1);
  }

  appendAfterMessageId(message: Message, id: string): void {
    l.info(`${this.logPrefix()} append message after message by id: ${id}`);
    const index = this.findIndex((message) => message.id === id);
    if (index === -1) {
      throw new Error(`Message with id "${id}" not found`);
    }
    this.splice(index + 1, 0, message);
  }

  replaceById(id: string, message: Message): void {
    l.info(`${this.logPrefix()} replace message by id: ${id}`);
    const index = this.findIndex((message) => message.id === id);
    if (index === -1) {
      throw new Error(`Message with id "${id}" not found`);
    }
    this[index] = message;
  }

  replaceAll(messages: Message[]): ChatHistory {
    l.info(`${this.logPrefix()} replace all messages`);
    this.length = 0;
    this.push(...messages);
    return this;
  }

  public formatToOpenAi(): ChatCompletionMessage[] {
    l.info(`${this.logPrefix()} format messages to OpenAI format`);
    let messages = this.map((message) => message.formatToOpenAi()).filter(
      isNotUndefined,
    );

    return messages;
  }
}
