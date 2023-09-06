export var ChatCompletionCallInitiator;
(function (ChatCompletionCallInitiator) {
    ChatCompletionCallInitiator["main_flow"] = "MAIN_FLOW";
    ChatCompletionCallInitiator["injection"] = "INJECTION";
    ChatCompletionCallInitiator["call_again"] = "CALL_AGAIN";
    ChatCompletionCallInitiator["set_function_result"] = "SET_FUNCTION_RESULT";
})(ChatCompletionCallInitiator || (ChatCompletionCallInitiator = {}));
export var MiddlewareStatus;
(function (MiddlewareStatus) {
    MiddlewareStatus["CONTINUE"] = "CONTINUE";
    MiddlewareStatus["CALL_AGAIN"] = "CALL_AGAIN";
    MiddlewareStatus["NOT_RETURNED"] = "NOT_RETURNED";
    MiddlewareStatus["STOP"] = "STOP";
})(MiddlewareStatus || (MiddlewareStatus = {}));
