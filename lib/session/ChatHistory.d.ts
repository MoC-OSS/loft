import { Message } from './Message';
import { QueryByArrayOfObjects } from './QueryByArrayOfInstance';
import { PalmMessage } from '../@types';
declare const l: unique symbol;
export declare class ChatHistory extends QueryByArrayOfObjects<Message> {
    private readonly [l];
    constructor(sessionId: string, systemMessageName: string, ...items: Message[]);
    append(message: Message): void;
    updateById(id: string, newData: Partial<Message>): void;
    archiveById(id: string): void;
    deleteById(id: string): void;
    appendAfterMessageId(message: Message, id: string): void;
    replaceById(id: string, message: Message): void;
    replaceAll(messages: Message[]): ChatHistory;
    formatToLLM(): PalmMessage[];
}
export {};
//# sourceMappingURL=ChatHistory.d.ts.map