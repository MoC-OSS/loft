"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiddlewareStatus = exports.ChatCompletionCallInitiator = void 0;
var ChatCompletionCallInitiator;
(function (ChatCompletionCallInitiator) {
    ChatCompletionCallInitiator["main_flow"] = "MAIN_FLOW";
    ChatCompletionCallInitiator["injection"] = "INJECTION";
    ChatCompletionCallInitiator["call_again"] = "CALL_AGAIN";
    ChatCompletionCallInitiator["set_function_result"] = "SET_FUNCTION_RESULT";
})(ChatCompletionCallInitiator || (exports.ChatCompletionCallInitiator = ChatCompletionCallInitiator = {}));
var MiddlewareStatus;
(function (MiddlewareStatus) {
    MiddlewareStatus["CONTINUE"] = "CONTINUE";
    MiddlewareStatus["CALL_AGAIN"] = "CALL_AGAIN";
    MiddlewareStatus["NOT_RETURNED"] = "NOT_RETURNED";
    MiddlewareStatus["STOP"] = "STOP";
})(MiddlewareStatus || (exports.MiddlewareStatus = MiddlewareStatus = {}));
