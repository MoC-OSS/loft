"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionStorage = void 0;
const helpers_1 = require("../helpers");
const Session_1 = require("./Session");
const ChatHistory_1 = require("./ChatHistory");
class SessionStorage {
    client;
    sessionTtl;
    appName;
    constructor(client, sessionTtl, appName) {
        this.client = client;
        this.sessionTtl = sessionTtl;
        this.appName = appName;
    }
    getChatCompletionSessionKey(sessionId, systemMessageName) {
        return `app:${this.appName}:api_type:chat_completion:function:session_storage:session:${sessionId}:system_message:${systemMessageName}`;
    }
    async isExists(sessionId, systemMessageName) {
        const sessionKey = this.getChatCompletionSessionKey(sessionId, systemMessageName);
        const result = await this.client.exists(sessionKey);
        return result === 1;
    }
    async createSession(sessionId, systemMessageName, modelPreset, message) {
        const sessionKey = this.getChatCompletionSessionKey(sessionId, systemMessageName);
        const timestamp = (0, helpers_1.getTimestamp)();
        const session = new Session_1.Session(this, {
            sessionId,
            systemMessageName,
            modelPreset,
            messages: new ChatHistory_1.ChatHistory(this, message),
            lastMessageByRole: {
                user: null,
                assistant: null,
                system: message,
                function: null,
            },
            handlersCount: {},
            ctx: {},
            createdAt: timestamp,
            updatedAt: timestamp,
        });
        await this.client.set(sessionKey, JSON.stringify(session), 'EX', this.sessionTtl);
    }
    async updateAllMessages(sessionId, systemMessageName, messages) {
        try {
            let session = await this.getSession(sessionId, systemMessageName);
            session.messages.length = 0; // clear messages array
            messages.forEach((message) => {
                session.messages.push(message);
                session.lastMessageByRole[message.role] = message;
            });
            session.updatedAt = (0, helpers_1.getTimestamp)();
            const sessionKey = this.getChatCompletionSessionKey(sessionId, systemMessageName);
            await this.client.set(sessionKey, JSON.stringify(session), 'EX', this.sessionTtl);
            session = await this.getSession(sessionId, systemMessageName);
            return session.messages;
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }
    async appendMessages(sessionId, systemMessageName, newMessages) {
        try {
            const session = await this.getSession(sessionId, systemMessageName);
            newMessages.forEach((newMessage) => {
                session.messages.push(newMessage);
                session.lastMessageByRole[newMessage.role] = newMessage;
            });
            session.updatedAt = (0, helpers_1.getTimestamp)();
            const sessionKey = this.getChatCompletionSessionKey(sessionId, systemMessageName);
            await this.client.set(sessionKey, JSON.stringify(session), 'EX', this.sessionTtl);
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }
    async replaceLastUserMessage(sessionId, systemMessageName, newMessage, role = 'user') {
        const session = await this.getSession(sessionId, systemMessageName);
        if (session.messages[session.messages.length - 1].role === role) {
            session.updatedAt = (0, helpers_1.getTimestamp)();
            session.messages[session.messages.length - 1].content =
                newMessage.content;
            const sessionKey = this.getChatCompletionSessionKey(sessionId, systemMessageName);
            await this.client.set(sessionKey, JSON.stringify(session), 'EX', this.sessionTtl);
        }
        else {
            throw new Error("Last message isn't user role message");
        }
    }
    async deleteSession(sessionId, systemMessageName) {
        const sessionKey = this.getChatCompletionSessionKey(sessionId, systemMessageName);
        await this.client.del(sessionKey);
    }
    async deleteSessionsById(sessionId) {
        const keys = await this.findKeysByPartialName(sessionId);
        await this.client.del(keys);
    }
    async findKeysByPartialName(partialKey) {
        try {
            return this.client.keys(`*${partialKey}*`);
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }
    async incrementHandlerCount(sessionId, systemMessageName, handlerName) {
        const session = await this.getSession(sessionId, systemMessageName);
        if (!session.handlersCount[handlerName]) {
            session.handlersCount[handlerName] = 0;
        }
        session.handlersCount[handlerName] += 1;
        const sessionKey = this.getChatCompletionSessionKey(sessionId, systemMessageName);
        await this.client.set(sessionKey, JSON.stringify(session), 'EX', this.sessionTtl);
    }
    async saveCtx(sessionId, systemMessageName, ctx) {
        const session = await this.getSession(sessionId, systemMessageName);
        if ((0, helpers_1.deepEqual)(session.ctx, ctx))
            return session; //skip if ctx is the same
        session.ctx = ctx;
        const sessionKey = this.getChatCompletionSessionKey(sessionId, systemMessageName);
        await this.client.set(sessionKey, JSON.stringify(session), 'EX', this.sessionTtl);
        return this.getSession(sessionId, systemMessageName);
    }
    async getSession(sessionId, systemMessageName) {
        const sessionKey = this.getChatCompletionSessionKey(sessionId, systemMessageName);
        const sessionData = await this.client.get(sessionKey);
        if (!sessionData) {
            throw new Error(`Session ${sessionId} not found`);
        }
        const SessionData = JSON.parse(sessionData);
        const session = new Session_1.Session(this, SessionData);
        return session;
    }
}
exports.SessionStorage = SessionStorage;
