import { SessionStorage } from './session/SessionStorage';
import {
  ChatCompletionCallInitiator,
  ErrorHandler,
  OutputContext,
} from './@types';
import { getLogger } from './Logger';

const l = getLogger('EventManager');

export type EventDetector = (
  response: OutputContext,
  next: () => Promise<void>,
) => Promise<boolean>;

export type Handler = (
  response: OutputContext,
  next: () => Promise<void>,
) => Promise<void>;

export interface EventHandler {
  eventDetector: EventDetector;
  handler: Handler;
  priority: number;
  maxLoops: number;
}

export type DefaultHandler = (response: OutputContext) => Promise<void>;

export interface TriggeredEvent {
  name: string;
  priority: number;
}

export class EventManager {
  private eventHandlers: Map<string, EventHandler>;
  private defaultEventHandler: DefaultHandler;

  constructor(
    private readonly sessionStorage: SessionStorage,
    private errorHandler: ErrorHandler,
  ) {
    l.info('EventManager initialization...');

    this.defaultEventHandler = async () => {
      l.error(
        'LLM Event not detected. Library try to continue with DefaultEventHandler, but it is not defined. Please define using useDefaultHandler(response: string): Promise<void> to receive the response.',
      );
    };

    this.eventHandlers = new Map();
  }

  use(name: string, eventHandler: EventHandler) {
    if (this.eventHandlers.has(name)) {
      throw new Error(
        `An event handler with the name "${name}" already exists.`,
      );
    }

    // Set a default value for maxLoops if it's not set
    if (eventHandler.maxLoops === undefined) {
      eventHandler.maxLoops = 10; // default value
    }
    // Set a default value for priority if it's not set
    if (!eventHandler.priority) {
      eventHandler.priority = 0; // default value
    }

    l.info(
      `Registered event handler with the name "${name}". Priority: ${eventHandler.priority}. Max Loops: ${eventHandler.maxLoops}.`,
    );

    this.eventHandlers.set(name, eventHandler);
  }

  useDefault(eventHandler: DefaultHandler) {
    l.info(`Registered default EventHandler.`);
    this.defaultEventHandler = eventHandler;
  }

  async executeEventHandlers(response: OutputContext): Promise<void> {
    let eventHandlersIterator = this.eventHandlers.entries();
    let currentEventHandlerEntry = eventHandlersIterator.next();
    let triggeredEvents: TriggeredEvent[] = [];

    try {
      const next = async (): Promise<void> => {
        if (currentEventHandlerEntry.done) return;
        let [name, eventHandler] = currentEventHandlerEntry.value;
        currentEventHandlerEntry = eventHandlersIterator.next();

        try {
          const trigger = await eventHandler.eventDetector(response, next);
          if (trigger) {
            triggeredEvents.push({ name, priority: eventHandler.priority });
          }
        } catch (error) {
          l.error(
            `Error occurred in eventDetector of event handler ${name}: ${error}`,
          );
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
            if (response.initiator === ChatCompletionCallInitiator.call_again)
              await this.sessionStorage.incrementHandlerCount(
                sessionId,
                systemMessageName,
                name,
              );
            response.session = await this.sessionStorage.getSession(
              sessionId,
              systemMessageName,
            );

            // over-loop handler prevention
            const { handlersCount } = response.session;
            if (handlersCount[name] >= eventHandler.maxLoops)
              return this.errorHandler(
                new Error(
                  `Max Loops Reached, handler: ${name}, maxLoops: ${eventHandler.maxLoops}, counted maxLoops: ${handlersCount[name]}. Please check your event handlers or if your flow requires it, increase maxLoops property of the event handler to a higher value.`,
                ),
                response,
              );

            await eventHandler.handler(response, () => Promise.resolve());
          } catch (error) {
            this.errorHandler(error as Error, response);
            throw error;
          }
        }
      }
    } catch (error) {
      l.error(`Error occurred while executing event handlers: ${error}`);
    }
  }
}
