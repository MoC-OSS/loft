import { SessionStorage } from './session/SessionStorage';
import { OutputContext } from './@types';
import { Session } from './session/Session';

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
  priority: 0;
  maxLoops: number;
}

export type DefaultHandler = (response: OutputContext) => Promise<void>;
export type ErrorHandler = (
  response: OutputContext,
  error: Error,
) => Promise<void>;

export interface TriggeredEvent {
  name: string;
  priority: number;
}

export class EventManager {
  private eventHandlers: Map<string, EventHandler>;
  private defaultEventHandler: DefaultHandler;
  private errorHandler: ErrorHandler;

  constructor(private readonly sessionStorage: SessionStorage) {
    this.defaultEventHandler = () => {
      console.error(
        'No Default Event Handler defined. Please define using useDefaultHandler(response: string): Promise<void>',
      );
      process.exit(1);
    };
    this.errorHandler = () => {
      console.error(
        'No ErrorHandler defined. Please define using useErrorHandler(err): Promise<void>',
      );
      process.exit(1);
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

    this.eventHandlers.set(name, eventHandler);
  }

  useDefault(eventHandler: DefaultHandler) {
    this.defaultEventHandler = eventHandler;
  }
  useError(eventHandler: ErrorHandler) {
    this.errorHandler = eventHandler;
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
          console.error(
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
            await this.sessionStorage.incrementHandlerCount(
              sessionId,
              systemMessageName,
              name,
            );
            response.session = (await this.sessionStorage.getSession(
              sessionId,
              systemMessageName,
            )) as Session;

            // over-loop handler prevention
            const { handlersCount } = response.session;
            if (handlersCount[name] >= eventHandler.maxLoops + 1)
              return this.errorHandler(
                response,
                new Error(
                  `Max Loops Reached, handler: ${name}, maxLoops: ${eventHandler.maxLoops}, counted maxLoops: ${handlersCount[name]}. Please check your event handlers or if your flow requires it, increase maxLoops property of the event handler to a higher value.`,
                ),
              );

            await eventHandler.handler(response, () => Promise.resolve());
          } catch (error) {
            console.error(
              `Error occurred in handler of event handler ${name}: `,
              error,
            );
            throw error;
          }
        }
      }
    } catch (error) {
      console.error(`Error occurred while executing event handlers: ${error}`);
    }
  }
}
