"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Session = void 0;
const ChatHistory_1 = require("./ChatHistory");
class Session {
    sessionStorage;
    sessionId;
    systemMessageName;
    modelPreset;
    messages;
    lastMessageByRole;
    handlersCount;
    ctx;
    createdAt;
    updatedAt;
    constructor(sessionStorage, sessionData) {
        this.sessionStorage = sessionStorage;
        this.sessionId = sessionData.sessionId;
        this.systemMessageName = sessionData.systemMessageName;
        this.modelPreset = sessionData.modelPreset;
        this.messages = new ChatHistory_1.ChatHistory(this.sessionStorage, ...sessionData.messages);
        this.lastMessageByRole = sessionData.lastMessageByRole;
        this.handlersCount = sessionData.handlersCount;
        this.ctx = sessionData.ctx;
        this.createdAt = sessionData.createdAt;
        this.updatedAt = sessionData.updatedAt;
    }
    async saveCtx() {
        return this.sessionStorage.saveCtx(this.sessionId, this.systemMessageName, this.ctx);
    }
    async saveMessages() {
        return this.sessionStorage.updateAllMessages(this.sessionId, this.systemMessageName, this.messages);
    }
    async delete() {
        this.sessionStorage.deleteSession(this.sessionId, this.systemMessageName);
    }
    toJSON() {
        return {
            sessionId: this.sessionId,
            systemMessageName: this.systemMessageName,
            modelPreset: this.modelPreset,
            messages: this.messages,
            lastMessageByRole: this.lastMessageByRole,
            handlersCount: this.handlersCount,
            ctx: this.ctx,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
}
exports.Session = Session;
