import {
  AsyncLLMInputMiddleware,
  AsyncLLMOutputMiddleware,
  IOContext,
  InputContext,
  InputData,
  LLMInputMiddlewares,
  LLMOutputMiddlewares,
  MiddlewareStatus,
  OutputContext,
} from './@types';
import { HistoryStorage } from './HistoryStorage';

export type InputMiddlewareContext = {
  message: string;
};

export class LlmIOManager {
  private llmInputMiddlewareChain: LLMInputMiddlewares = new Map();
  private llmOutputMiddlewareChain: LLMOutputMiddlewares = new Map();

  constructor(private readonly hs: HistoryStorage) {}

  useInput(name: string, middleware: AsyncLLMInputMiddleware) {
    if (this.llmInputMiddlewareChain.has(middleware.name)) {
      throw new Error(
        `A input middleware with the name "${name}" already exists.`,
      );
    }
    this.llmInputMiddlewareChain.set(name, middleware);
  }

  useOutput(name: string, middleware: AsyncLLMOutputMiddleware) {
    if (this.llmOutputMiddlewareChain.has(middleware.name)) {
      throw new Error(
        `A output middleware with the name "${name}" already exists.`,
      );
    }
    this.llmOutputMiddlewareChain.set(name, middleware);
  }

  async executeInputMiddlewareChain(
    inputContext: InputContext,
  ): Promise<InputContext> {
    let middlewaresIterator = this.llmInputMiddlewareChain.entries();
    let currentMiddlewareEntry = middlewaresIterator.next();
    let modifiedContext: InputContext = { ...inputContext };

    try {
      const next = async (
        modifiedInputContext: InputContext,
      ): Promise<void> => {
        if (currentMiddlewareEntry.done) return;
        let [name, middleware] = currentMiddlewareEntry.value;
        currentMiddlewareEntry = middlewaresIterator.next();

        try {
          await middleware(
            modifiedInputContext,
            (nextInputContext: InputContext) => {
              modifiedContext = { ...nextInputContext };
              return next(modifiedContext);
            },
          );
        } catch (error) {
          console.error(`Error occurred in middleware ${name}: ${error}`);
          throw error;
        }
      };

      await next(inputContext);
    } catch (error) {
      console.error(
        `Error occurred while executing middleware chain: ${error}`,
      );
    }

    return modifiedContext;
  }

  async executeOutputMiddlewareChain(
    outputContext: OutputContext,
  ): Promise<[status: string, outputContext: OutputContext]> {
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
          const { status, newOutputContext } = await middleware(
            modifiedOutputContext,
            (nextIOContext: OutputContext) => {
              modifiedContext = { ...nextIOContext };
              return next(modifiedContext);
            },
          );

          if (newOutputContext)
            modifiedContext.session = await this.hs.upsertCtx(
              outputContext.session.sessionId,
              outputContext.session.systemMessageName,
              newOutputContext?.session.ctx,
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
          console.error(`Error occurred in middleware ${name}: ${error}`);
          throw error;
        }
      };

      await next(outputContext);
    } catch (error) {
      console.error(
        `Error occurred while executing middleware chain: ${error}`,
      );
    }

    const isCallAgain = middlewareStatuses.some(({ status }) =>
      status.includes(MiddlewareStatus.CALL_AGAIN),
    );

    if (isCallAgain) return [MiddlewareStatus.CALL_AGAIN, modifiedContext];
    else return [MiddlewareStatus.CONTINUE, modifiedContext];
  }
}
