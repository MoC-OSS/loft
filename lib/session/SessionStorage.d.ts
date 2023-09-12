import { Redis, Cluster } from 'ioredis';
import { SessionProps } from '../@types';
import { Session } from './Session';
import { Message } from './Message';
export declare class SessionStorage {
    private readonly client;
    private readonly sessionTtl;
    private readonly appName;
    constructor(client: Redis | Cluster, sessionTtl: number, appName: string);
    private getChatCompletionSessionKey;
    isExists(sessionId: string, systemMessageName: string): Promise<boolean>;
    createSession(sessionId: string, systemMessageName: string, systemMessage: string, model: string, modelPreset: SessionProps['modelPreset'], examples: SessionProps['examples'], messages: Message[], ctx?: SessionProps['ctx']): Promise<void>;
    appendMessages(sessionId: string, systemMessageName: string, newMessages: Message[], ctx?: SessionProps['ctx']): Promise<void>;
    appendMessagesToAccumulator(sessionId: string, systemMessageName: string, newMessages: Message[], session?: Session, ctx?: SessionProps['ctx']): Promise<void>;
    deleteSession(sessionId: string, systemMessageName: string): Promise<void>;
    deleteSessionsById(sessionId: string): Promise<void>;
    private findKeysByPartialName;
    incrementHandlerCount(sessionId: string, systemMessageName: string, handlerName: string): Promise<void>;
    save(session: Session): Promise<Session>;
    getSession(sessionId: string, systemMessageName: string): Promise<Session>;
}
//# sourceMappingURL=SessionStorage.d.ts.map