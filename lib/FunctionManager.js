"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionManager = void 0;
const Logger_1 = require("./Logger");
const l = (0, Logger_1.getLogger)('FunctionManager');
class FunctionManager {
    functions;
    constructor() {
        this.functions = new Map();
    }
    use(name, fn) {
        if (this.functions.has(name)) {
            throw new Error(`A function with the name "${name}" already exists.`);
        }
        l.info(`Registering AI function with the name "${name}".`);
        this.functions.set(name, fn);
    }
    async executeFunction(expectedFnName, args, ctx) {
        try {
            const functions = ctx.session.modelPreset?.functions;
            if (!functions)
                throw new Error('No functions exist in SystemMessage.');
            const fnManifest = functions.find((manifest) => manifest?.name === expectedFnName);
            if (!fnManifest)
                throw new Error(`No function manifest in SystemMessage with the name "${expectedFnName}" exists.`);
            const fn = this.functions.get(expectedFnName);
            if (!fn)
                throw new Error(`No registered function-callback with the name "${expectedFnName}" exists.`);
            return fn(ctx, args);
        }
        catch (err) {
            throw new Error(`Error executing registered LLM function "${expectedFnName}": ${err}`);
        }
    }
}
exports.FunctionManager = FunctionManager;
