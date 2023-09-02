"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatHistory = void 0;
const helpers_1 = require("../helpers");
const Message_1 = require("./Message");
const QueryByArrayOfInstance_1 = require("./QueryByArrayOfInstance");
const Logger_1 = require("./../Logger");
const logger = (0, Logger_1.getLogger)('ChatHistory');
const l = Symbol('logger');
class ChatHistory extends QueryByArrayOfInstance_1.QueryByArrayOfObjects {
    [l]; // this Symbol property for exclude logger from built-in Array methods of instance
    constructor(sessionId, systemMessageName, ...items) {
        super(...items.map((item) => new Message_1.Message(item)));
        this[l] = logger.child({ sessionId, systemMessageName });
        this[l].info(`ChatHistory initialization...`);
    }
    append(message) {
        this[l].info(`append new message`);
        this.push(message);
    }
    // partial update by id
    updateById(id, newData) {
        this[l].info(`update message with id: ${id}`);
        const index = this.findIndex((message) => message.id === id);
        if (index === -1) {
            throw new Error(`Message with id "${id}" not found`);
        }
        this[index] = new Message_1.Message(Object.assign({}, this[index], newData));
    }
    archiveById(id) {
        this[l].info(`archive message with id: ${id}`);
        this.updateById(id, { isArchived: true });
    }
    deleteById(id) {
        this[l].info(`delete message by id: ${id}`);
        const index = this.findIndex((message) => message.id === id);
        if (index === -1) {
            throw new Error(`Message with id "${id}" not found`);
        }
        this.splice(index, 1);
    }
    appendAfterMessageId(message, id) {
        this[l].info(`append message after message by id: ${id}`);
        const index = this.findIndex((message) => message.id === id);
        if (index === -1) {
            throw new Error(`Message with id "${id}" not found`);
        }
        this.splice(index + 1, 0, message);
    }
    replaceById(id, message) {
        this[l].info(`replace message by id: ${id}`);
        const index = this.findIndex((message) => message.id === id);
        if (index === -1) {
            throw new Error(`Message with id "${id}" not found`);
        }
        this[index] = message;
    }
    replaceAll(messages) {
        this[l].info(`replace all messages`);
        this.length = 0;
        this.push(...messages);
        return this;
    }
    formatToLLM() {
        this[l].info(`format messages to LLM format`);
        let messages = this.map((message) => message.formatToLLM()).filter(helpers_1.isNotUndefined);
        return messages;
    }
}
exports.ChatHistory = ChatHistory;
