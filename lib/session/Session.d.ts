import { SessionProps } from './../@types';
import { SessionStorage } from './SessionStorage';
import { ChatCompletionRequestMessage, ChatCompletionResponseMessage } from 'openai';
import { SystemMessageType } from '../schema/CreateChatCompletionRequestSchema';
import { ChatHistory } from './ChatHistory';
import { Message } from './Message';
export declare class Session implements SessionProps {
    private readonly sessionStorage;
    readonly sessionId: string;
    readonly systemMessageName: string;
    readonly modelPreset: SystemMessageType['modelPreset'];
    messages: ChatHistory;
    lastMessageByRole: {
        user: ChatCompletionRequestMessage | null;
        assistant: ChatCompletionResponseMessage | null;
        system: ChatCompletionResponseMessage | null;
        function: ChatCompletionResponseMessage | null;
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