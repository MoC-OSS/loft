import { AsyncLLMMiddleware, LLMMiddlewares } from './@types';

export class LlmIOManager {
  private llmInputMiddlewareChain: LLMMiddlewares = new Map();
  private llmOutputMiddlewareChain: LLMMiddlewares = new Map();

  useInput(name: string, middleware: AsyncLLMMiddleware) {
    if (this.llmInputMiddlewareChain.has(middleware.name)) {
      throw new Error(
        `A input middleware with the name "${name}" already exists.`,
      );
    }
    this.llmInputMiddlewareChain.set(name, middleware);
  }

  useOutput(name: string, middleware: AsyncLLMMiddleware) {
    if (this.llmOutputMiddlewareChain.has(middleware.name)) {
      throw new Error(
        `A output middleware with the name "${name}" already exists.`,
      );
    }
    this.llmOutputMiddlewareChain.set(name, middleware);
  }

  async executeInputMiddlewareChain(inputText: string): Promise<string> {
    return this.executeMiddlewareChain(inputText, this.llmInputMiddlewareChain);
  }

  async executeOutputMiddlewareChain(outputText: string): Promise<string> {
    return this.executeMiddlewareChain(
      outputText,
      this.llmOutputMiddlewareChain,
    );
  }

  private async executeMiddlewareChain(
    inputText: string,
    middlewares: LLMMiddlewares,
  ): Promise<string> {
    let middlewaresIterator = middlewares.entries();
    let currentMiddlewareEntry = middlewaresIterator.next();
    let modifiedText: string = inputText;

    try {
      const next = async (modifiedInputText: string): Promise<void> => {
        if (currentMiddlewareEntry.done) return;
        let [name, middleware] = currentMiddlewareEntry.value;
        currentMiddlewareEntry = middlewaresIterator.next();

        try {
          await middleware(modifiedInputText, (nextInputText: string) => {
            modifiedText = nextInputText;
            return next(modifiedText);
          });
        } catch (error) {
          console.error(`Error occurred in middleware ${name}: ${error}`);
          throw error;
        }
      };

      await next(inputText);
    } catch (error) {
      console.error(
        `Error occurred while executing middleware chain: ${error}`,
      );
    }

    return modifiedText;
  }
}
