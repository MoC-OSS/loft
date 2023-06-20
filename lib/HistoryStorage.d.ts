import { Redis, Cluster } from 'ioredis';
import { ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum, ChatCompletionResponseMessage } from 'openai';
import { SessionData } from './@types';
export declare class HistoryStorage {
    private client;
    private sessionTtl;
    constructor(client: Redis | Cluster, sessionTtl: number);
    private getSessionKey;
    isExists(sessionId: string): Promise<boolean>;
    createSession(sessionId: string, modelPreset: SessionData['modelPreset'], messages: ChatCompletionRequestMessage[]): Promise<void>;
    updateMessages(sessionId: string, newMessage: ChatCompletionResponseMessage | ChatCompletionRequestMessage): Promise<void>;
    replaceLastUserMessage(sessionId: string, newMessage: ChatCompletionResponseMessage | ChatCompletionRequestMessage, role?: ChatCompletionRequestMessageRoleEnum): Promise<void>;
    deleteSession(sessionId: string): Promise<void>;
    deleteSessionsById(sessionId: string): Promise<void>;
    findKeysByPartialName(partialKey: string): Promise<string[]>;
    getSession(sessionId: string): Promise<SessionData>;
}
//# sourceMappingURL=HistoryStorage.d.ts.map