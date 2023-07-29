import { SessionStorage } from './session/SessionStorage';
import { OutputContext } from './@types';
import { Session } from './session/Session';
import { ChatCompletionCallInitiator } from './ChatCompletion';
export type EventDetector = (response: OutputContext, next: () => Promise<void>) => Promise<boolean>;
export type Handler = (response: OutputContext, next: () => Promise<void>) => Promise<void>;
export interface EventHandler {
    eventDetector: EventDetector;
    handler: Handler;
    priority: number;
    maxLoops: number;
}
export type DefaultHandler = (response: OutputContext) => Promise<void>;
export type ErrorHandler = (error: Error | unknown, response?: Partial<OutputContext> | {
    initiator: ChatCompletionCallInitiator;
    sessionId: Session['sessionId'];
    systemMessageName: Session['systemMessageName'];
} | undefined) => Promise<void>;
export interface TriggeredEvent {
    name: string;
    priority: number;
}
export declare class EventManager {
    private readonly sessionStorage;
    private errorHandler;
    private eventHandlers;
    private defaultEventHandler;
    constructor(sessionStorage: SessionStorage, errorHandler: ErrorHandler);
    use(name: string, eventHandler: EventHandler): void;
    useDefault(eventHandler: DefaultHandler): void;
    executeEventHandlers(response: OutputContext): Promise<void>;
}
//# sourceMappingURL=EventManager.d.ts.map