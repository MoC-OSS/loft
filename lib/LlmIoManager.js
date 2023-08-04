"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmIOManager = void 0;
const _types_1 = require("./@types");
const Logger_1 = require("./Logger");
const l = (0, Logger_1.getLogger)('LlmIOManager');
class LlmIOManager {
    llmInputMiddlewareChain = new Map();
    llmOutputMiddlewareChain = new Map();
    constructor() {
        l.info('LlmIOManager initialization...');
    }
    useInput(name, middleware) {
        if (this.llmInputMiddlewareChain.has(middleware.name)) {
            throw new Error(`A input middleware with the name "${name}" already exists.`);
        }
        l.info(`Registered input middleware with the name "${name}".`);
        this.llmInputMiddlewareChain.set(name, middleware);
    }
    useOutput(name, middleware) {
        if (this.llmOutputMiddlewareChain.has(middleware.name)) {
            throw new Error(`A output middleware with the name "${name}" already exists.`);
        }
        l.info(`Registered output middleware with the name "${name}".`);
        this.llmOutputMiddlewareChain.set(name, middleware);
    }
    async executeInputMiddlewareChain(inputContext) {
        if (this.llmInputMiddlewareChain.size === 0) {
            return inputContext;
        }
        const { sessionId, systemMessageName } = inputContext;
        l.info(`sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - Executing input middleware chain`);
        let middlewaresIterator = this.llmInputMiddlewareChain.entries();
        let currentMiddlewareEntry = middlewaresIterator.next();
        let modifiedContext = { ...inputContext };
        try {
            const next = async (modifiedInputContext) => {
                if (currentMiddlewareEntry.done)
                    return;
                let [name, middleware] = currentMiddlewareEntry.value;
                currentMiddlewareEntry = middlewaresIterator.next();
                try {
                    l.info(`sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - Executing middleware: ${name}...`);
                    // TODO: need refactor middleware. each middleware should return modified context to check type of context
                    await middleware(modifiedInputContext, (nextInputContext) => {
                        modifiedContext = { ...nextInputContext };
                        return next(modifiedContext);
                    });
                }
                catch (error) {
                    l.error(`Error occurred in middleware ${name}: ${error}`);
                    throw error;
                }
            };
            await next(inputContext);
        }
        catch (error) {
            l.error(`Error occurred while executing middleware chain by sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - ${error}`);
        }
        return modifiedContext;
    }
    async executeOutputMiddlewareChain(outputContext) {
        if (this.llmOutputMiddlewareChain.size === 0) {
            return [_types_1.MiddlewareStatus.CONTINUE, outputContext];
        }
        const { sessionId, systemMessageName } = outputContext.session;
        l.info(`sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - Executing output middleware chain`);
        let middlewaresIterator = this.llmOutputMiddlewareChain.entries();
        let currentMiddlewareEntry = middlewaresIterator.next();
        let modifiedContext = { ...outputContext };
        const middlewareStatuses = [];
        try {
            const next = async (modifiedOutputContext) => {
                if (currentMiddlewareEntry.done)
                    return;
                let [name, middleware] = currentMiddlewareEntry.value;
                currentMiddlewareEntry = middlewaresIterator.next();
                try {
                    l.info(`sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - Executing middleware: ${name}...`);
                    const { status, newOutputContext } = await middleware(modifiedOutputContext, (nextIOContext) => {
                        modifiedContext = { ...nextIOContext };
                        return next(modifiedContext);
                    });
                    middlewareStatuses.push({
                        name,
                        status: status || _types_1.MiddlewareStatus.NOT_RETURNED,
                    });
                    if (status === _types_1.MiddlewareStatus.CALL_AGAIN ||
                        status === _types_1.MiddlewareStatus.STOP) {
                        return;
                    }
                    else if (newOutputContext && status === _types_1.MiddlewareStatus.CONTINUE) {
                        return next(newOutputContext);
                    }
                }
                catch (error) {
                    l.error(`Error occurred in middleware ${name}: ${error}`);
                    throw error;
                }
            };
            await next(outputContext);
        }
        catch (error) {
            l.error(`Error occurred while executing middleware chain: ${error}`);
        }
        l.info(`sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - Middleware statuses: ${middlewareStatuses}`);
        const isCallAgain = middlewareStatuses.some(({ status }) => status.includes(_types_1.MiddlewareStatus.CALL_AGAIN) ||
            status.includes(_types_1.MiddlewareStatus.STOP));
        modifiedContext.session.save();
        if (isCallAgain) {
            l.info(`sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - LLM Response handling will not be finished. Because one of Output Middlewares returned status: ${_types_1.MiddlewareStatus.CALL_AGAIN} | ${_types_1.MiddlewareStatus.STOP}, which means that the Output Middlewares chain will be executed again in the next iteration.`);
            return [_types_1.MiddlewareStatus.CALL_AGAIN, modifiedContext];
        }
        else {
            l.info(`sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - LLM Response successfully handled by Output Middlewares. and will will be passed to EventManager handlers.`);
            return [_types_1.MiddlewareStatus.CONTINUE, modifiedContext];
        }
    }
}
exports.LlmIOManager = LlmIOManager;
