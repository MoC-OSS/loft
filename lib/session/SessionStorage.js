"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionStorage = void 0;
const openai_1 = require("openai");
const helpers_1 = require("../helpers");
const Session_1 = require("./Session");
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
        const sessionData = {
            sessionId,
            systemMessageName,
            modelPreset,
            messages: [message],
            lastMessageByRole: {
                user: null,
                assistant: null,
                system: message,
                function: null,
            },
            ctx: {},
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await this.client.set(sessionKey, JSON.stringify(sessionData), 'EX', this.sessionTtl);
    }
    async updateMessages(sessionId, systemMessageName, newMessage) {
        try {
            const sessionKey = this.getChatCompletionSessionKey(sessionId, systemMessageName);
            const sessionData = await this.getSession(sessionId, systemMessageName);
            sessionData.messages.push(newMessage);
            sessionData.updatedAt = new Date();
            if (newMessage.role === openai_1.ChatCompletionResponseMessageRoleEnum.User)
                sessionData.lastMessageByRole.user = newMessage;
            if (newMessage.role === openai_1.ChatCompletionResponseMessageRoleEnum.Assistant)
                sessionData.lastMessageByRole.assistant = newMessage;
            if (newMessage.role === openai_1.ChatCompletionResponseMessageRoleEnum.System)
                sessionData.lastMessageByRole.system = newMessage;
            if (newMessage.role === openai_1.ChatCompletionResponseMessageRoleEnum.Function)
                sessionData.lastMessageByRole.function = newMessage;
            await this.client.set(sessionKey, JSON.stringify(sessionData), 'EX', this.sessionTtl);
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }
    async replaceLastUserMessage(sessionId, systemMessageName, newMessage, role = 'user') {
        const session = await this.getSession(sessionId, systemMessageName);
        if (session.messages[session.messages.length - 1].role === role) {
            session.updatedAt = new Date();
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
    async saveCtx(sessionId, systemMessageName, ctx) {
        const sessionKey = this.getChatCompletionSessionKey(sessionId, systemMessageName);
        const session = await this.getSession(sessionKey, systemMessageName);
        if ((0, helpers_1.deepEqual)(session.ctx, ctx))
            return session; //skip if ctx is the same
        session.ctx = ctx;
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
