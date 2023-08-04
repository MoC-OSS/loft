import {
  AsyncLLMInputMiddleware,
  AsyncLLMOutputMiddleware,
  ChatInputPayload,
  LLMInputMiddlewares,
  LLMOutputMiddlewares,
  MiddlewareStatus,
  OutputContext,
} from './@types';
import { getLogger } from './Logger';

const l = getLogger('LlmIOManager');

export type InputMiddlewareContext = {
  message: string;
};

export class LlmIOManager {
  private llmInputMiddlewareChain: LLMInputMiddlewares = new Map();
  private llmOutputMiddlewareChain: LLMOutputMiddlewares = new Map();

  constructor() {
    l.info('LlmIOManager initialization...');
  }

  useInput(name: string, middleware: AsyncLLMInputMiddleware) {
    if (this.llmInputMiddlewareChain.has(middleware.name)) {
      throw new Error(
        `A input middleware with the name "${name}" already exists.`,
      );
    }
    l.info(`Registered input middleware with the name "${name}".`);
    this.llmInputMiddlewareChain.set(name, middleware);
  }

  useOutput(name: string, middleware: AsyncLLMOutputMiddleware) {
    if (this.llmOutputMiddlewareChain.has(middleware.name)) {
      throw new Error(
        `A output middleware with the name "${name}" already exists.`,
      );
    }
    l.info(`Registered output middleware with the name "${name}".`);
    this.llmOutputMiddlewareChain.set(name, middleware);
  }

  async executeInputMiddlewareChain(
    inputContext: ChatInputPayload,
  ): Promise<ChatInputPayload> {
    if (this.llmInputMiddlewareChain.size === 0) {
      return inputContext;
    }
    const { sessionId, systemMessageName } = inputContext;
    l.info(
      `sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - Executing input middleware chain`,
    );
    let middlewaresIterator = this.llmInputMiddlewareChain.entries();
    let currentMiddlewareEntry = middlewaresIterator.next();
    let modifiedContext: ChatInputPayload = { ...inputContext };

    try {
      const next = async (
        modifiedInputContext: ChatInputPayload,
      ): Promise<void> => {
        if (currentMiddlewareEntry.done) return;
        let [name, middleware] = currentMiddlewareEntry.value;
        currentMiddlewareEntry = middlewaresIterator.next();

        try {
          l.info(
            `sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - Executing middleware: ${name}...`,
          );
          // TODO: need refactor middleware. each middleware should return modified context to check type of context
          await middleware(
            modifiedInputContext,
            (nextInputContext: ChatInputPayload) => {
              modifiedContext = { ...nextInputContext };
              return next(modifiedContext);
            },
          );
        } catch (error) {
          l.error(`Error occurred in middleware ${name}: ${error}`);
          throw error;
        }
      };

      await next(inputContext);
    } catch (error) {
      l.error(
        `Error occurred while executing middleware chain by sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - ${error}`,
      );
    }

    return modifiedContext;
  }

  async executeOutputMiddlewareChain(
    outputContext: OutputContext,
  ): Promise<[status: string, outputContext: OutputContext]> {
    if (this.llmOutputMiddlewareChain.size === 0) {
      return [MiddlewareStatus.CONTINUE, outputContext];
    }

    const { sessionId, systemMessageName } = outputContext.session;
    l.info(
      `sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - Executing output middleware chain`,
    );
    let middlewaresIterator = this.llmOutputMiddlewareChain.entries();
    let currentMiddlewareEntry = middlewaresIterator.next();
    let modifiedContext: OutputContext = { ...outputContext };
    const middlewareStatuses: { name: string; status: MiddlewareStatus }[] = [];

    try {
      const next = async (
        modifiedOutputContext: OutputContext,
      ): Promise<void> => {
        if (currentMiddlewareEntry.done) return;
        let [name, middleware] = currentMiddlewareEntry.value;
        currentMiddlewareEntry = middlewaresIterator.next();

        try {
          l.info(
            `sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - Executing middleware: ${name}...`,
          );
          const { status, newOutputContext } = await middleware(
            modifiedOutputContext,
            (nextIOContext: OutputContext) => {
              modifiedContext = { ...nextIOContext };
              return next(modifiedContext);
            },
          );

          middlewareStatuses.push({
            name,
            status: status || MiddlewareStatus.NOT_RETURNED,
          });

          if (
            status === MiddlewareStatus.CALL_AGAIN ||
            status === MiddlewareStatus.STOP
          ) {
            return;
          } else if (newOutputContext && status === MiddlewareStatus.CONTINUE) {
            return next(newOutputContext);
          }
        } catch (error) {
          l.error(`Error occurred in middleware ${name}: ${error}`);
          throw error;
        }
      };
      await next(outputContext);
    } catch (error) {
      l.error(`Error occurred while executing middleware chain: ${error}`);
    }

    l.info(
      `sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - Middleware statuses: ${middlewareStatuses}`,
    );
    const isCallAgain = middlewareStatuses.some(
      ({ status }) =>
        status.includes(MiddlewareStatus.CALL_AGAIN) ||
        status.includes(MiddlewareStatus.STOP),
    );

    modifiedContext.session.save();

    if (isCallAgain) {
      l.info(
        `sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - LLM Response handling will not be finished. Because one of Output Middlewares returned status: ${MiddlewareStatus.CALL_AGAIN} | ${MiddlewareStatus.STOP}, which means that the Output Middlewares chain will be executed again in the next iteration.`,
      );
      return [MiddlewareStatus.CALL_AGAIN, modifiedContext];
    } else {
      l.info(
        `sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - LLM Response successfully handled by Output Middlewares. and will will be passed to EventManager handlers.`,
      );
      return [MiddlewareStatus.CONTINUE, modifiedContext];
    }
  }
}
