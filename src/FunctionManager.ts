import { OutputContext } from './@types';
import { getLogger } from './Logger';

const l = getLogger('FunctionManager');

export type OpenAiFunctionArgs = any;

export type OpenAiFunction = (
  ctx: OutputContext,
  args: OpenAiFunctionArgs,
) => Promise<string>;

export class FunctionManager {
  functions: Map<string, OpenAiFunction>;

  constructor() {
    this.functions = new Map();
  }

  use(name: string, fn: OpenAiFunction) {
    if (this.functions.has(name)) {
      throw new Error(`A function with the name "${name}" already exists.`);
    }

    l.info(`Registering AI function with the name "${name}".`);
    this.functions.set(name, fn);
  }
}
