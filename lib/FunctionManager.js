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
}
exports.FunctionManager = FunctionManager;
