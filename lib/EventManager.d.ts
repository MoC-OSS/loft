import { OutputContext } from './@types';
import { HistoryStorage } from './HistoryStorage';
export type EventDetector = (response: OutputContext, next: () => Promise<void>) => Promise<boolean>;
export type Handler = (response: OutputContext, next: () => Promise<void>) => Promise<void>;
export interface EventHandler {
    eventDetector: EventDetector;
    handler: Handler;
    priority: 0;
}
export type defaultHandler = (response: OutputContext) => Promise<void>;
export interface TriggeredEvent {
    name: string;
    priority: number;
}
export declare class EventManager {
    private readonly hs;
    private eventHandlers;
    private defaultEventHandler;
    constructor(hs: HistoryStorage);
    use(name: string, eventHandler: EventHandler): void;
    useDefault(eventHandler: defaultHandler): void;
    executeEventHandlers(response: OutputContext): Promise<void>;
}
//# sourceMappingURL=EventManager.d.ts.map