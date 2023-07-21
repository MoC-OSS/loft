import { ChatCompletionMessage } from '../@types';
import { isNotUndefined } from '../helpers';
import { Message } from './Message';
import { QueryByArrayOfObjects } from './QueryByArrayOfInstance';
import { SessionStorage } from './SessionStorage';

export class ChatHistory extends QueryByArrayOfObjects<Message> {
  constructor(private readonly hs: SessionStorage, ...items: Message[]) {
    super(...items.map((item) => new Message(item)));
  }

  append(message: Message): void {
    this.push(message);
  }

  // partial update by id
  updateById(id: string, newData: Partial<Message>): void {
    const index = this.findIndex((message) => message.id === id);
    if (index === -1) {
      throw new Error(`Message with id "${id}" not found`);
    }
    this[index] = new Message({ ...this[index], ...newData });
  }

  archiveById(id: string): void {
    this.updateById(id, { isArchived: true });
  }

  deleteById(id: string): void {
    const index = this.findIndex((message) => message.id === id);
    if (index === -1) {
      throw new Error(`Message with id "${id}" not found`);
    }
    this.splice(index, 1);
  }

  appendAfterMessageId(message: Message, id: string): void {
    const index = this.findIndex((message) => message.id === id);
    if (index === -1) {
      throw new Error(`Message with id "${id}" not found`);
    }
    this.splice(index + 1, 0, message);
  }

  replaceById(id: string, message: Message): void {
    const index = this.findIndex((message) => message.id === id);
    if (index === -1) {
      throw new Error(`Message with id "${id}" not found`);
    }
    this[index] = message;
  }

  replaceAll(messages: Message[]): ChatHistory {
    this.length = 0;
    this.push(...messages);
    return this;
  }

  save(sessionId: string, systemMessageName: string): void {
    this.hs.updateAllMessages(sessionId, systemMessageName, this);
  }

  // toJSON() {
  //   return [...this.map((message) => message.toJSON())];
  // }

  public formatToOpenAi(): ChatCompletionMessage[] {
    let messages = this.map((message) => message.formatToOpenAi()).filter(
      isNotUndefined,
    );

    return messages;
  }
}
