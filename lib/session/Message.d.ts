import { PalmMessage } from '../@types';
import { ChatCompletionRequestMessageFunctionCall } from 'openai';
export declare enum MessageType {
    INJECTION = "injection",
    EMBEDDING = "embedding"
}
export declare class Message implements Omit<PalmMessage, 'author'> {
    id: string;
    author: 'user' | 'assistant';
    citationMetadata?: PalmMessage['citationMetadata'];
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
        author: Message['author'];
        citationMetadata?: Message['citationMetadata'];
        content?: Message['content'];
        name?: Message['name'];
        function_call?: Message['function_call'];
        type?: Message['type'];
        tags?: Message['tags'];
        customProperties?: Message['customProperties'];
        isArchived?: Message['isArchived'];
        createdAt?: Message['createdAt'];
        updatedAt?: Message['updatedAt'];
    });
    toJSON(): Partial<Message>;
    formatToLLM(): PalmMessage | undefined;
}
//# sourceMappingURL=Message.d.ts.map