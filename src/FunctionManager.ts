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

  async executeFunction(
    expectedFnName: string,
    args: OpenAiFunctionArgs,
    ctx: OutputContext,
  ): Promise<string> {
    try {
      const functions = ctx.session.modelPreset?.functions;
      if (!functions) throw new Error('No functions exist in SystemMessage.');

      const fnManifest = functions.find(
        (manifest) => manifest?.name === expectedFnName,
      );
      if (!fnManifest)
        throw new Error(
          `No function manifest in SystemMessage with the name "${expectedFnName}" exists.`,
        );

      const fn = this.functions.get(expectedFnName);
      if (!fn)
        throw new Error(
          `No registered function-callback with the name "${expectedFnName}" exists.`,
        );

      return fn(ctx, args);
    } catch (err) {
      throw new Error(
        `Error executing registered LLM function "${expectedFnName}": ${err}`,
      );
    }
  }
}
