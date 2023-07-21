import { SessionData } from './../@types';
import { SessionStorage } from './SessionStorage';
import { ChatCompletionRequestMessage, ChatCompletionResponseMessage } from 'openai';
import { SystemMessageType } from '../schema/CreateChatCompletionRequestSchema';
import { ChatHistory } from './ChatHistory';
export declare class Session implements SessionData {
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
    readonly createdAt: number;
    updatedAt: number;
    constructor(sessionStorage: SessionStorage, sessionData: SessionData);
    saveCtx(): Promise<void>;
    saveMessages(): Promise<void>;
    delete(): Promise<void>;
    toJSON(): SessionData;
}
//# sourceMappingURL=Session.d.ts.map