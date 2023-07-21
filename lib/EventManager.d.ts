import { SessionStorage } from './session/SessionStorage';
import { OutputContext } from './@types';
export type EventDetector = (response: OutputContext, next: () => Promise<void>) => Promise<boolean>;
export type Handler = (response: OutputContext, next: () => Promise<void>) => Promise<void>;
export interface EventHandler {
    eventDetector: EventDetector;
    handler: Handler;
    priority: number;
    maxLoops: number;
}
export type DefaultHandler = (response: OutputContext) => Promise<void>;
export type ErrorHandler = (response: OutputContext, error: Error) => Promise<void>;
export interface TriggeredEvent {
    name: string;
    priority: number;
}
export declare class EventManager {
    private readonly sessionStorage;
    private eventHandlers;
    private defaultEventHandler;
    private errorHandler;
    constructor(sessionStorage: SessionStorage);
    use(name: string, eventHandler: EventHandler): void;
    useDefault(eventHandler: DefaultHandler): void;
    useError(eventHandler: ErrorHandler): void;
    executeEventHandlers(response: OutputContext): Promise<void>;
}
//# sourceMappingURL=EventManager.d.ts.map