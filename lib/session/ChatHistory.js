"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatHistory = void 0;
const helpers_1 = require("../helpers");
const Message_1 = require("./Message");
const QueryByArrayOfInstance_1 = require("./QueryByArrayOfInstance");
const Logger_1 = require("./../Logger");
const l = (0, Logger_1.getLogger)('ChatHistory');
class ChatHistory extends QueryByArrayOfInstance_1.QueryByArrayOfObjects {
    sessionId;
    systemMessageName;
    constructor(sessionId, systemMessageName, ...items) {
        super(...items.map((item) => new Message_1.Message(item)));
        this.sessionId = sessionId;
        this.systemMessageName = systemMessageName;
        l.info(`${this.logPrefix()} - ChatHistory initialization...`);
    }
    logPrefix() {
        return `sessionId: ${this.sessionId}, systemMessageName: ${this.systemMessageName} -`;
    }
    append(message) {
        l.info(`${this.logPrefix()}  append new message`);
        this.push(message);
    }
    // partial update by id
    updateById(id, newData) {
        l.info(`${this.logPrefix()} update message with id: ${id}`);
        const index = this.findIndex((message) => message.id === id);
        if (index === -1) {
            throw new Error(`Message with id "${id}" not found`);
        }
        this[index] = new Message_1.Message({ ...this[index], ...newData });
    }
    archiveById(id) {
        l.info(`${this.logPrefix()} archive message with id: ${id}`);
        this.updateById(id, { isArchived: true });
    }
    deleteById(id) {
        l.info(`${this.logPrefix()} delete message by id: ${id}`);
        const index = this.findIndex((message) => message.id === id);
        if (index === -1) {
            throw new Error(`Message with id "${id}" not found`);
        }
        this.splice(index, 1);
    }
    appendAfterMessageId(message, id) {
        l.info(`${this.logPrefix()} append message after message by id: ${id}`);
        const index = this.findIndex((message) => message.id === id);
        if (index === -1) {
            throw new Error(`Message with id "${id}" not found`);
        }
        this.splice(index + 1, 0, message);
    }
    replaceById(id, message) {
        l.info(`${this.logPrefix()} replace message by id: ${id}`);
        const index = this.findIndex((message) => message.id === id);
        if (index === -1) {
            throw new Error(`Message with id "${id}" not found`);
        }
        this[index] = message;
    }
    replaceAll(messages) {
        l.info(`${this.logPrefix()} replace all messages`);
        this.length = 0;
        this.push(...messages);
        return this;
    }
    formatToOpenAi() {
        l.info(`${this.logPrefix()} format messages to OpenAI format`);
        let messages = this.map((message) => message.formatToOpenAi()).filter(helpers_1.isNotUndefined);
        return messages;
    }
}
exports.ChatHistory = ChatHistory;
