import { ChatCompletionRequestMessageFunctionCall, ChatCompletionRequestMessageRoleEnum } from 'openai';
import { ChatCompletionMessage } from '../@types';
export declare enum MessageType {
    INJECTION = "injection",
    EMBEDDING = "embedding"
}
export declare class Message implements ChatCompletionMessage {
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
    });
    toJSON(): {
        id: string;
        role: ChatCompletionRequestMessageRoleEnum;
        content: string | undefined;
        name: string | undefined;
        function_call: ChatCompletionRequestMessageFunctionCall | undefined;
        type: MessageType | null | undefined;
        tags: string[] | null | undefined;
        customProperties: {} | Record<string, unknown>;
        isArchived: boolean;
        createdAt: Number | undefined;
        updatedAt: Number | undefined;
    };
    formatToOpenAi(): ChatCompletionMessage | undefined;
}
//# sourceMappingURL=Message.d.ts.map