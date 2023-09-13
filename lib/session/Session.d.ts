import { SessionProps } from './../@types';
import { SessionStorage } from './SessionStorage';
import { PalmExamples, SystemMessageType } from '../schema/CreateChatCompletionRequestSchema';
import { ChatHistory } from './ChatHistory';
import { Message } from './Message';
import { ContextRecord } from '../schema/ChatCompletionSchema';
export declare class Session implements SessionProps {
    private readonly sessionStorage;
    readonly sessionId: string;
    readonly systemMessageName: string;
    readonly systemMessage: string;
    readonly model: string;
    readonly modelPreset: SystemMessageType['modelPreset'];
    messages: ChatHistory;
    readonly examples: PalmExamples;
    lastMessageByRole: {
        user: Message | null;
        assistant: Message | null;
    };
    handlersCount: Record<string, number>;
    ctx: ContextRecord;
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