import { PalmExample, SessionProps } from './../@types';
import { SessionStorage } from './SessionStorage';
import { SystemMessageType } from '../schema/CreateChatCompletionRequestSchema';
import { ChatHistory } from './ChatHistory';
import { Message } from './Message';
export declare class Session implements SessionProps {
    private readonly sessionStorage;
    readonly sessionId: string;
    readonly systemMessageName: string;
    readonly systemMessage: string;
    readonly model: string;
    readonly modelPreset: SystemMessageType['modelPreset'];
    messages: ChatHistory;
    readonly examples: PalmExample[];
    lastMessageByRole: {
        user: Message | null;
        assistant: Message | null;
    };
    handlersCount: Record<string, number>;
    ctx: Record<string, unknown>;
    messageAccumulator: Message[] | null;
    readonly createdAt: number;
    updatedAt: number;
    lastError: string | null;
    constructor(sessionStorage: SessionStorage, sessionData: SessionProps);
    private logPrefix;
    save(): Promise<Session>;
    delete(): Promise<void>;
    toJSON(): SessionProps;
}
//# sourceMappingURL=Session.d.ts.map