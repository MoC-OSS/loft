import { ChatCompletionMessage, SessionData } from './../@types';
import { SessionStorage } from './SessionStorage';
import { ChatCompletionRequestMessage, ChatCompletionResponseMessage } from 'openai';
import { SystemMessageType } from '../schema/CreateChatCompletionRequestSchema';
export declare class Session implements SessionData {
    private readonly sessionStorage;
    readonly sessionId: string;
    readonly systemMessageName: string;
    readonly modelPreset: SystemMessageType['modelPreset'];
    readonly messages: ChatCompletionMessage[];
    readonly lastMessageByRole: {
        user: ChatCompletionRequestMessage | null;
        assistant: ChatCompletionResponseMessage | null;
        system: ChatCompletionResponseMessage | null;
        function: ChatCompletionResponseMessage | null;
    };
    readonly handlersCount: Record<string, number>;
    ctx: Record<string, unknown>;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    constructor(sessionStorage: SessionStorage, sessionData: SessionData);
    saveCtx(): Promise<void>;
    delete(): Promise<void>;
    toJSON(): SessionData;
}
//# sourceMappingURL=Session.d.ts.map