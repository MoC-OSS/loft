import { ChatCompletionMessage } from '../@types';
import { Message } from './Message';
import { QueryByArrayOfObjects } from './QueryByArrayOfInstance';
import { SessionStorage } from './SessionStorage';
export declare class ChatHistory extends QueryByArrayOfObjects<Message> {
    private readonly hs;
    constructor(hs: SessionStorage, ...items: Message[]);
    append(message: Message): void;
    updateById(id: string, newData: Partial<Message>): void;
    archiveById(id: string): void;
    deleteById(id: string): void;
    appendAfterMessageId(message: Message, id: string): void;
    replaceById(id: string, message: Message): void;
    replaceAll(messages: Message[]): ChatHistory;
    formatToOpenAi(): ChatCompletionMessage[];
}
//# sourceMappingURL=ChatHistory.d.ts.map