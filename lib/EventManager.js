"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventManager = void 0;
const ChatCompletion_1 = require("./ChatCompletion");
const Logger_1 = require("./Logger");
const l = (0, Logger_1.getLogger)('EventManager');
class EventManager {
    sessionStorage;
    errorHandler;
    eventHandlers;
    defaultEventHandler;
    constructor(sessionStorage, errorHandler) {
        this.sessionStorage = sessionStorage;
        this.errorHandler = errorHandler;
        l.info('EventManager initialization...');
        this.defaultEventHandler = async () => {
            l.error('LLM Event not detected. Library try to continue with DefaultEventHandler, but it is not defined. Please define using useDefaultHandler(response: string): Promise<void> to receive the response.');
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
        l.info(`Registered event handler with the name "${name}". Priority: ${eventHandler.priority}. Max Loops: ${eventHandler.maxLoops}.`);
        this.eventHandlers.set(name, eventHandler);
    }
    useDefault(eventHandler) {
        l.info(`Registered default event handler.`);
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
                    l.error(`Error occurred in eventDetector of event handler ${name}: ${error}`);
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
                        if (response.initiator === ChatCompletion_1.ChatCompletionCallInitiator.call_again)
                            await this.sessionStorage.incrementHandlerCount(sessionId, systemMessageName, name);
                        response.session = await this.sessionStorage.getSession(sessionId, systemMessageName);
                        // over-loop handler prevention
                        const { handlersCount } = response.session;
                        if (handlersCount[name] >= eventHandler.maxLoops)
                            return this.errorHandler(new Error(`Max Loops Reached, handler: ${name}, maxLoops: ${eventHandler.maxLoops}, counted maxLoops: ${handlersCount[name]}. Please check your event handlers or if your flow requires it, increase maxLoops property of the event handler to a higher value.`), response);
                        await eventHandler.handler(response, () => Promise.resolve());
                    }
                    catch (error) {
                        this.errorHandler(error, response);
                        throw error;
                    }
                }
            }
        }
        catch (error) {
            l.error(`Error occurred while executing event handlers: ${error}`);
        }
    }
}
exports.EventManager = EventManager;
