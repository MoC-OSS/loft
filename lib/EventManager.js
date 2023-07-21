"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventManager = void 0;
class EventManager {
    sessionStorage;
    eventHandlers;
    defaultEventHandler;
    errorHandler;
    constructor(sessionStorage) {
        this.sessionStorage = sessionStorage;
        this.defaultEventHandler = () => {
            console.error('No Default Event Handler defined. Please define using useDefaultHandler(response: string): Promise<void>');
            process.exit(1);
        };
        this.errorHandler = () => {
            console.error('No ErrorHandler defined. Please define using useErrorHandler(err): Promise<void>');
            process.exit(1);
        };
        this.eventHandlers = new Map();
    }
    use(name, eventHandler) {
        if (this.eventHandlers.has(name)) {
            throw new Error(`An event handler with the name "${name}" already exists.`);
        }
        // Set a default value for maxLoops if it's not set
        if (eventHandler.maxLoops === undefined) {
            eventHandler.maxLoops = 10; // default value
        }
        // Set a default value for priority if it's not set
        if (!eventHandler.priority) {
            eventHandler.priority = 0; // default value
        }
        this.eventHandlers.set(name, eventHandler);
    }
    useDefault(eventHandler) {
        this.defaultEventHandler = eventHandler;
    }
    useError(eventHandler) {
        this.errorHandler = eventHandler;
    }
    async executeEventHandlers(response) {
        let eventHandlersIterator = this.eventHandlers.entries();
        let currentEventHandlerEntry = eventHandlersIterator.next();
        let triggeredEvents = [];
        try {
            const next = async () => {
                if (currentEventHandlerEntry.done)
                    return;
                let [name, eventHandler] = currentEventHandlerEntry.value;
                currentEventHandlerEntry = eventHandlersIterator.next();
                try {
                    const trigger = await eventHandler.eventDetector(response, next);
                    if (trigger) {
                        triggeredEvents.push({ name, priority: eventHandler.priority });
                    }
                }
                catch (error) {
                    console.error(`Error occurred in eventDetector of event handler ${name}: ${error}`);
                    throw error;
                }
            };
            await next();
            // if no event handler was triggered, execute the default event handler
            if (triggeredEvents.length === 0)
                return this.defaultEventHandler(response);
            triggeredEvents.sort((a, b) => b.priority - a.priority);
            if (triggeredEvents.length > 0) {
                const { name } = triggeredEvents[0];
                const eventHandler = this.eventHandlers.get(name);
                if (eventHandler) {
                    try {
                        // tracking the number of times an event handler is called
                        const { sessionId, systemMessageName } = response.session;
                        await this.sessionStorage.incrementHandlerCount(sessionId, systemMessageName, name);
                        response.session = await this.sessionStorage.getSession(sessionId, systemMessageName);
                        // over-loop handler prevention
                        const { handlersCount } = response.session;
                        if (handlersCount[name] >= eventHandler.maxLoops + 1)
                            return this.errorHandler(response, new Error(`Max Loops Reached, handler: ${name}, maxLoops: ${eventHandler.maxLoops}, counted maxLoops: ${handlersCount[name]}. Please check your event handlers or if your flow requires it, increase maxLoops property of the event handler to a higher value.`));
                        await eventHandler.handler(response, () => Promise.resolve());
                    }
                    catch (error) {
                        console.error(`Error occurred in handler of event handler ${name}: `, error);
                        throw error;
                    }
                }
            }
        }
        catch (error) {
            console.error(`Error occurred while executing event handlers: ${error}`);
        }
    }
}
exports.EventManager = EventManager;
