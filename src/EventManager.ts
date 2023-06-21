import { InputContext, OutputContext } from './@types';
import { HistoryStorage } from './HistoryStorage';

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
}

export type defaultHandler = (response: OutputContext) => Promise<void>;

export interface TriggeredEvent {
  name: string;
  priority: number;
}

export class EventManager {
  private eventHandlers: Map<string, EventHandler>;
  private defaultEventHandler: defaultHandler;

  constructor(private readonly hs: HistoryStorage) {
    this.defaultEventHandler = () => {
      console.error(
        'No Default Event Handler defined. Please define using useDefaultHandler(response: string): Promise<void>',
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
    this.eventHandlers.set(name, eventHandler);
  }

  useDefault(eventHandler: defaultHandler) {
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
          console.error(
            `Error occurred in eventDetector of event handler ${name}: ${error}`,
          );
          throw error;
        }
      };

      await next();

      // if no event handler was triggered, execute the default event handler
      if (triggeredEvents.length === 0) this.defaultEventHandler(response);

      triggeredEvents.sort((a, b) => b.priority - a.priority);

      if (triggeredEvents.length > 0) {
        const { name } = triggeredEvents[0];
        const eventHandler = this.eventHandlers.get(name);
        if (eventHandler) {
          try {
            await eventHandler.handler(response, () => Promise.resolve());

            if (response)
              response.session = await this.hs.upsertCtx(
                response?.session.sessionId,
                response?.session.ctx,
              );
          } catch (error) {
            console.error(
              `Error occurred in handler of event handler ${name}: ${error}`,
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

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
