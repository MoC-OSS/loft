"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryStorage = void 0;
class HistoryStorage {
    client;
    sessionTtl;
    constructor(client, sessionTtl) {
        this.client = client;
        this.sessionTtl = sessionTtl;
    }
    getSessionKey(sessionId) {
        return `chat:${sessionId}`;
    }
    async isExists(sessionId) {
        const sessionKey = this.getSessionKey(sessionId);
        const result = await this.client.exists(sessionKey);
        return result === 1;
    }
    async createSession(sessionId, modelPreset, messages) {
        const sessionKey = this.getSessionKey(sessionId);
        const sessionData = {
            sessionId,
            modelPreset,
            messages,
            ctx: {},
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await this.client.set(sessionKey, JSON.stringify(sessionData), 'EX', this.sessionTtl);
    }
    async updateMessages(sessionId, newMessage) {
        try {
            const sessionKey = this.getSessionKey(sessionId);
            const sessionData = await this.getSession(sessionId);
            sessionData.messages.push(newMessage);
            sessionData.updatedAt = new Date();
            await this.client.set(sessionKey, JSON.stringify(sessionData), 'EX', this.sessionTtl);
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }
    async replaceLastUserMessage(sessionId, newMessage, role = 'user') {
        const session = await this.getSession(sessionId);
        if (session.messages[session.messages.length - 1].role === role) {
            session.updatedAt = new Date();
            session.messages[session.messages.length - 1].content =
                newMessage.content;
            const sessionKey = this.getSessionKey(sessionId);
            await this.client.set(sessionKey, JSON.stringify(session), 'EX', this.sessionTtl);
        }
        else {
            throw new Error("Last message isn't user role message");
        }
    }
    async deleteSession(sessionId) {
        const sessionKey = this.getSessionKey(sessionId);
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
    // async getMessages(
    //   sessionId: string,
    // ): Promise<ChatCompletionRequestMessage[]> {
    //   const sessionData = await this.getSession(sessionId);
    //   return sessionData.messages;
    // }
    async upsertCtx(sessionId, ctx) {
        const sessionKey = this.getSessionKey(sessionId);
        const session = await this.getSession(sessionId);
        if (this.deepEqual(session.ctx, ctx))
            return session; //skip if ctx is the same
        session.ctx = ctx;
        await this.client.set(sessionKey, JSON.stringify(session), 'EX', this.sessionTtl);
        return this.getSession(sessionId);
    }
    async getSession(sessionId) {
        const sessionKey = this.getSessionKey(sessionId);
        const sessionData = await this.client.get(sessionKey);
        if (!sessionData) {
            throw new Error(`Session ${sessionId} not found`);
        }
        return JSON.parse(sessionData);
    }
    deepEqual(obj1, obj2) {
        if (obj1 === obj2) {
            return true;
        }
        if (typeof obj1 !== 'object' ||
            obj1 === null ||
            typeof obj2 !== 'object' ||
            obj2 === null) {
            return false;
        }
        let keys1 = Object.keys(obj1);
        let keys2 = Object.keys(obj2);
        if (keys1.length !== keys2.length) {
            return false;
        }
        for (let key of keys1) {
            if (!keys2.includes(key) || !this.deepEqual(obj1[key], obj2[key])) {
                return false;
            }
        }
        return true;
    }
}
exports.HistoryStorage = HistoryStorage;
