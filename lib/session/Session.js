"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Session = void 0;
const ChatHistory_1 = require("./ChatHistory");
const Logger_1 = require("./../Logger");
const l = (0, Logger_1.getLogger)('Session');
class Session {
    sessionStorage;
    sessionId;
    systemMessageName;
    modelPreset;
    messages;
    lastMessageByRole;
    handlersCount;
    ctx;
    messageAccumulator;
    createdAt;
    updatedAt;
    lastError;
    constructor(sessionStorage, sessionData) {
        this.sessionStorage = sessionStorage;
        this.sessionId = sessionData.sessionId;
        this.systemMessageName = sessionData.systemMessageName;
        l.info(`${this.logPrefix()} Session initialization...`);
        this.modelPreset = sessionData.modelPreset;
        this.messages = new ChatHistory_1.ChatHistory(sessionData.sessionId, sessionData.systemMessageName, ...sessionData.messages);
        this.lastMessageByRole = sessionData.lastMessageByRole;
        this.handlersCount = sessionData.handlersCount;
        this.ctx = sessionData.ctx;
        this.messageAccumulator = sessionData.messageAccumulator || null;
        this.createdAt = sessionData.createdAt;
        this.updatedAt = sessionData.updatedAt;
        this.lastError = sessionData.lastError;
    }
    logPrefix() {
        return `sessionId: ${this.sessionId}, systemMessageName: ${this.systemMessageName} -`;
    }
    async save() {
        l.info(`${this.logPrefix()} - save session`);
        return this.sessionStorage.save(this);
    }
    async delete() {
        l.info(`${this.logPrefix()} - delete session`);
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
            messageAccumulator: this.messageAccumulator,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            lastError: this.lastError,
        };
    }
}
exports.Session = Session;
