"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventManager = void 0;
class EventManager {
    hs;
    eventHandlers;
    defaultEventHandler;
    constructor(hs) {
        this.hs = hs;
        this.defaultEventHandler = () => {
            console.error('No Default Event Handler defined. Please define using useDefaultHandler(response: string): Promise<void>');
            process.exit(1);
        };
        this.eventHandlers = new Map();
    }
    use(name, eventHandler) {
        if (this.eventHandlers.has(name)) {
            throw new Error(`An event handler with the name "${name}" already exists.`);
        }
        this.eventHandlers.set(name, eventHandler);
    }
    useDefault(eventHandler) {
        this.defaultEventHandler = eventHandler;
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
                this.defaultEventHandler(response);
            triggeredEvents.sort((a, b) => b.priority - a.priority);
            if (triggeredEvents.length > 0) {
                const { name } = triggeredEvents[0];
                const eventHandler = this.eventHandlers.get(name);
                if (eventHandler) {
                    try {
                        await eventHandler.handler(response, () => Promise.resolve());
                        if (response)
                            response.session = await this.hs.upsertCtx(response.session.sessionId, response.session.systemMessageName, response.session.ctx);
                    }
                    catch (error) {
                        console.error(`Error occurred in handler of event handler ${name}: ${error}`);
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
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
