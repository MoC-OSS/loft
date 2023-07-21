"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatHistory = void 0;
const helpers_1 = require("../helpers");
const Message_1 = require("./Message");
const QueryByArrayOfInstance_1 = require("./QueryByArrayOfInstance");
class ChatHistory extends QueryByArrayOfInstance_1.QueryByArrayOfObjects {
    hs;
    constructor(hs, ...items) {
        super(...items.map((item) => new Message_1.Message(item)));
        this.hs = hs;
    }
    append(message) {
        this.push(message);
    }
    // partial update by id
    updateById(id, newData) {
        const index = this.findIndex((message) => message.id === id);
        if (index === -1) {
            throw new Error(`Message with id "${id}" not found`);
        }
        this[index] = new Message_1.Message({ ...this[index], ...newData });
    }
    archiveById(id) {
        this.updateById(id, { isArchived: true });
    }
    deleteById(id) {
        const index = this.findIndex((message) => message.id === id);
        if (index === -1) {
            throw new Error(`Message with id "${id}" not found`);
        }
        this.splice(index, 1);
    }
    appendAfterMessageId(message, id) {
        const index = this.findIndex((message) => message.id === id);
        if (index === -1) {
            throw new Error(`Message with id "${id}" not found`);
        }
        this.splice(index + 1, 0, message);
    }
    replaceById(id, message) {
        const index = this.findIndex((message) => message.id === id);
        if (index === -1) {
            throw new Error(`Message with id "${id}" not found`);
        }
        this[index] = message;
    }
    replaceAll(messages) {
        this.length = 0;
        this.push(...messages);
        return this;
    }
    save(sessionId, systemMessageName) {
        this.hs.updateAllMessages(sessionId, systemMessageName, this);
    }
    formatToOpenAi() {
        let messages = this.map((message) => message.formatToOpenAi()).filter(helpers_1.isNotUndefined);
        return messages;
    }
}
exports.ChatHistory = ChatHistory;
