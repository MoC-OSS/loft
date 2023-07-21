import {
  ChatCompletionRequestMessageFunctionCall,
  ChatCompletionRequestMessageRoleEnum,
} from 'openai';
import { v4 as uuid } from 'uuid';
import { ChatCompletionMessage } from '../@types';
import { getTimestamp } from '../helpers';

export enum MessageType {
  INJECTION = 'injection',
  EMBEDDING = 'embedding',
}

export class Message implements ChatCompletionMessage {
  id: string;
  role: ChatCompletionRequestMessageRoleEnum;
  content?: string;
  name?: string;
  function_call?: ChatCompletionRequestMessageFunctionCall;
  type?: MessageType | null;
  tags?: string[] | null;
  customProperties: Record<string, unknown> | {};
  isArchived: boolean;
  createdAt?: Number;
  updatedAt?: Number;

  constructor(msg: {
    id?: Message['id'];
    role: Message['role'];
    content?: Message['content'];
    name?: Message['name'];
    function_call?: Message['function_call'];
    type?: Message['type'];
    tags?: Message['tags'];
    customProperties?: Message['customProperties'];
    isArchived?: Message['isArchived'];
    createdAt?: Message['createdAt'];
    updatedAt?: Message['updatedAt'];
  }) {
    const timestamp = getTimestamp();

    this.id = msg.id || uuid();
    this.role = msg.role;
    this.content = msg.content;
    this.name = msg.name;
    this.function_call = msg.function_call;
    this.type = msg.type;
    this.tags = msg.tags || [];
    this.customProperties = msg.customProperties || {};
    this.isArchived = msg.isArchived || false;
    this.createdAt = msg.createdAt || timestamp;
    this.updatedAt = msg.updatedAt || timestamp;
  }

  toJSON() {
    return {
      id: this.id,
      role: this.role,
      content: this.content,
      name: this.name,
      function_call: this.function_call,
      type: this.type,
      tags: this.tags,
      customProperties: this.customProperties,
      isArchived: this.isArchived,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  //use to filter out additional fields
  public formatToOpenAi(): ChatCompletionMessage | undefined {
    if (this.isArchived === true) return undefined;

    return {
      role: this.role,
      content: this.content,
      name: this.name,
      function_call: this.function_call,
    };
  }
}
