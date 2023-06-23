"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmIOManager = void 0;
const _types_1 = require("./@types");
class LlmIOManager {
    hs;
    llmInputMiddlewareChain = new Map();
    llmOutputMiddlewareChain = new Map();
    constructor(hs) {
        this.hs = hs;
    }
    useInput(name, middleware) {
        if (this.llmInputMiddlewareChain.has(middleware.name)) {
            throw new Error(`A input middleware with the name "${name}" already exists.`);
        }
        this.llmInputMiddlewareChain.set(name, middleware);
    }
    useOutput(name, middleware) {
        if (this.llmOutputMiddlewareChain.has(middleware.name)) {
            throw new Error(`A output middleware with the name "${name}" already exists.`);
        }
        this.llmOutputMiddlewareChain.set(name, middleware);
    }
    async executeInputMiddlewareChain(inputContext) {
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
                    await middleware(modifiedInputContext, (nextInputContext) => {
                        modifiedContext = { ...nextInputContext };
                        return next(modifiedContext);
                    });
                }
                catch (error) {
                    console.error(`Error occurred in middleware ${name}: ${error}`);
                    throw error;
                }
            };
            await next(inputContext);
        }
        catch (error) {
            console.error(`Error occurred while executing middleware chain: ${error}`);
        }
        return modifiedContext;
    }
    async executeOutputMiddlewareChain(outputContext) {
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
                    const { status, newOutputContext } = await middleware(modifiedOutputContext, (nextIOContext) => {
                        modifiedContext = { ...nextIOContext };
                        return next(modifiedContext);
                    });
                    if (newOutputContext)
                        modifiedContext.session = await this.hs.upsertCtx(outputContext.session.sessionId, outputContext.session.systemMessageName, newOutputContext?.session.ctx);
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
                    console.error(`Error occurred in middleware ${name}: ${error}`);
                    throw error;
                }
            };
            await next(outputContext);
        }
        catch (error) {
            console.error(`Error occurred while executing middleware chain: ${error}`);
        }
        const isCallAgain = middlewareStatuses.some(({ status }) => status.includes(_types_1.MiddlewareStatus.CALL_AGAIN));
        if (isCallAgain)
            return [_types_1.MiddlewareStatus.CALL_AGAIN, modifiedContext];
        else
            return [_types_1.MiddlewareStatus.CONTINUE, modifiedContext];
    }
}
exports.LlmIOManager = LlmIOManager;
