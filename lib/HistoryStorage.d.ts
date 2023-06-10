import { Redis, Cluster } from 'ioredis';
import { ChatCompletionRequestMessage, ChatCompletionResponseMessage } from 'openai';
import { SystemMessageType } from './schema/CreateChatCompletionRequestSchema';
export interface SessionData {
    sessionId: string;
    modelPreset: SystemMessageType['modelPreset'];
    messages: ChatCompletionRequestMessage[];
    createdAt: Date;
    updatedAt: Date;
}
export declare class HistoryStorage {
    private client;
    private sessionTtl;
    constructor(client: Redis | Cluster, sessionTtl: number);
    private getSessionKey;
    isExists(sessionId: string): Promise<boolean>;
    createSession(sessionId: string, modelPreset: SessionData['modelPreset'], messages: ChatCompletionRequestMessage[]): Promise<void>;
    updateMessages(sessionId: string, newMessage: ChatCompletionResponseMessage | ChatCompletionRequestMessage): Promise<void>;
    replaceLastUserMessage(sessionId: string, newMessage: ChatCompletionResponseMessage | ChatCompletionRequestMessage): Promise<void>;
    deleteSession(sessionId: string): Promise<void>;
    getSession(sessionId: string): Promise<SessionData>;
}
//# sourceMappingURL=HistoryStorage.d.ts.map