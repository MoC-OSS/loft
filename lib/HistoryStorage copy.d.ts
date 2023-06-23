import { Redis, Cluster } from 'ioredis';
import { ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum, ChatCompletionResponseMessage } from 'openai';
import { SessionData } from './@types';
export declare class HistoryStorage {
    private readonly client;
    private readonly sessionTtl;
    private readonly appName;
    constructor(client: Redis | Cluster, sessionTtl: number, appName: string);
    private getChatCompletionSessionKey;
    isExists(sessionId: string, systemMessageName: string): Promise<boolean>;
    createSession(sessionId: string, systemMessageName: string, modelPreset: SessionData['modelPreset'], message: ChatCompletionRequestMessage): Promise<void>;
    updateMessages(sessionId: string, systemMessageName: string, newMessage: ChatCompletionResponseMessage | ChatCompletionRequestMessage): Promise<void>;
    replaceLastUserMessage(sessionId: string, systemMessageName: string, newMessage: ChatCompletionResponseMessage | ChatCompletionRequestMessage, role?: ChatCompletionRequestMessageRoleEnum): Promise<void>;
    deleteSession(sessionId: string, systemMessageName: string): Promise<void>;
    deleteSessionsById(sessionId: string): Promise<void>;
    findKeysByPartialName(partialKey: string): Promise<string[]>;
    upsertCtx(sessionId: string, systemMessageName: string, ctx: Record<string, unknown>): Promise<SessionData>;
    getSession(sessionId: string, systemMessageName: string): Promise<SessionData>;
    private deepEqual;
}
//# sourceMappingURL=HistoryStorage%20copy.d.ts.map