"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = exports.MessageType = void 0;
const uuid_1 = require("uuid");
const helpers_1 = require("../helpers");
var MessageType;
(function (MessageType) {
    MessageType["INJECTION"] = "injection";
    MessageType["EMBEDDING"] = "embedding";
})(MessageType || (exports.MessageType = MessageType = {}));
class Message {
    id;
    role;
    content;
    name;
    function_call;
    type;
    tags;
    customProperties;
    isArchived;
    createdAt;
    updatedAt;
    constructor(msg) {
        const timestamp = (0, helpers_1.getTimestamp)();
        this.id = msg.id || (0, uuid_1.v4)();
        this.role = msg.role;
        this.content = msg.content;
        this.name = msg.name;
        this.function_call = msg.function_call;
        this.type = msg.type;
        this.tags = msg.tags || [];
        this.customProperties = msg.customProperties || {};
        this.isArchived = msg.isArchived || false;
        this.createdAt = msg.createdAt || timestamp;
        this.updatedAt = msg.updatedAt || timestamp;
    }
    toJSON() {
        return {
            id: this.id,
            role: this.role,
            content: this.content,
            name: this.name,
            function_call: this.function_call,
            type: this.type,
            tags: this.tags,
            customProperties: this.customProperties,
            isArchived: this.isArchived,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
    //use to filter out additional fields
    formatToOpenAi() {
        if (this.isArchived === true)
            return undefined;
        return {
            role: this.role,
            content: this.content,
            name: this.name,
            function_call: this.function_call,
        };
    }
}
exports.Message = Message;
