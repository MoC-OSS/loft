"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmIOManager = void 0;
class LlmIOManager {
    llmInputMiddlewareChain = new Map();
    llmOutputMiddlewareChain = new Map();
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
    async executeInputMiddlewareChain(inputText) {
        return this.executeMiddlewareChain(inputText, this.llmInputMiddlewareChain);
    }
    async executeOutputMiddlewareChain(outputText) {
        return this.executeMiddlewareChain(outputText, this.llmOutputMiddlewareChain);
    }
    async executeMiddlewareChain(inputText, middlewares) {
        let middlewaresIterator = middlewares.entries();
        let currentMiddlewareEntry = middlewaresIterator.next();
        let modifiedText = inputText;
        try {
            const next = async (modifiedInputText) => {
                if (currentMiddlewareEntry.done)
                    return;
                let [name, middleware] = currentMiddlewareEntry.value;
                currentMiddlewareEntry = middlewaresIterator.next();
                try {
                    await middleware(modifiedInputText, (nextInputText) => {
                        modifiedText = nextInputText;
                        return next(modifiedText);
                    });
                }
                catch (error) {
                    console.error(`Error occurred in middleware ${name}: ${error}`);
                    throw error;
                }
            };
            await next(inputText);
        }
        catch (error) {
            console.error(`Error occurred while executing middleware chain: ${error}`);
        }
        return modifiedText;
    }
}
exports.LlmIOManager = LlmIOManager;
