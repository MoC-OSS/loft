import { v4 as uuid } from 'uuid';
import { PalmMessage } from '../@types';
import { getTimestamp } from '../helpers';

export enum MessageType {
  INJECTION = 'injection',
  EMBEDDING = 'embedding',
}

export class Message implements Omit<PalmMessage, 'author'> {
  id: string;
  author: 'user' | 'assistant';
  citationMetadata?: PalmMessage['citationMetadata'];
  content?: string;
  name?: string;
  tags?: string[] | null;
  customProperties: Record<string, unknown> | {};
  isArchived: boolean;
  createdAt?: Number;
  updatedAt?: Number;

  constructor(msg: {
    id?: Message['id'];
    author: Message['author'];
    citationMetadata?: Message['citationMetadata'];
    content?: Message['content'];
    name?: Message['name'];
    tags?: Message['tags'];
    customProperties?: Message['customProperties'];
    isArchived?: Message['isArchived'];
    createdAt?: Message['createdAt'];
    updatedAt?: Message['updatedAt'];
  }) {
    const timestamp = getTimestamp();

    this.id = msg.id || uuid();
    this.author = msg.author || 'user';
    this.content = msg.content;
    this.name = msg.name;
    this.tags = msg.tags || [];
    this.customProperties = msg.customProperties || {};
    this.isArchived = msg.isArchived || false;
    this.createdAt = msg.createdAt || timestamp;
    this.updatedAt = msg.updatedAt || timestamp;
  }

  toJSON(): Partial<Message> {
    return {
      id: this.id,
      author: this.author,
      citationMetadata: this.citationMetadata,
      content: this.content,
      name: this.name,
      tags: this.tags,
      customProperties: this.customProperties,
      isArchived: this.isArchived,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  //use to filter out additional fields
  public formatToLLM(): PalmMessage | undefined {
    if (this.isArchived === true) return undefined;

    const message = {
      author: this.author,
      content: this.content,
      citationMetadata: this.citationMetadata,
    };

    return JSON.parse(JSON.stringify(message)); //delete undefined fields
  }
}
