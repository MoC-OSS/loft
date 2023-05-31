export type EventDetector = (
  response: string,
  next: () => Promise<void>,
) => Promise<boolean>;

export type Handler = (
  response: string,
  next: () => Promise<void>,
) => Promise<void>;

export interface EventHandler {
  eventDetector: EventDetector;
  handler: Handler;
  priority: 0;
}

export interface TriggeredEvent {
  name: string;
  priority: number;
}

export class EventManager {
  private eventHandlers: Map<string, EventHandler>;

  constructor() {
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

  async executeEventHandlers(response: string): Promise<void> {
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

      triggeredEvents.sort((a, b) => b.priority - a.priority);

      if (triggeredEvents.length > 0) {
        const { name } = triggeredEvents[0];
        const eventHandler = this.eventHandlers.get(name);
        if (eventHandler) {
          try {
            await eventHandler.handler(response, () => Promise.resolve());
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
