export type EventDetector = (response: string, next: () => Promise<void>) => Promise<boolean>;
export type Handler = (response: string, next: () => Promise<void>) => Promise<void>;
export interface EventHandler {
    eventDetector: EventDetector;
    handler: Handler;
    priority: 0;
}
export type defaultHandler = (response: string) => Promise<void>;
export interface TriggeredEvent {
    name: string;
    priority: number;
}
export declare class EventManager {
    private eventHandlers;
    private defaultEventHandler;
    constructor();
    use(name: string, eventHandler: EventHandler): void;
    useDefault(eventHandler: defaultHandler): void;
    executeEventHandlers(response: string): Promise<void>;
}
//# sourceMappingURL=EventManager.d.ts.map