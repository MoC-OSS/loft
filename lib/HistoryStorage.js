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
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await this.client.set(sessionKey, JSON.stringify(sessionData), 'EX', this.sessionTtl);
    }
    async updateMessages(sessionId, newMessage) {
        const sessionKey = this.getSessionKey(sessionId);
        const sessionData = await this.getSession(sessionId);
        sessionData.messages.push(newMessage);
        sessionData.updatedAt = new Date();
        await this.client.set(sessionKey, JSON.stringify(sessionData), 'EX', this.sessionTtl);
    }
    async deleteSession(sessionId) {
        const sessionKey = this.getSessionKey(sessionId);
        await this.client.del(sessionKey);
    }
    // async getMessages(
    //   sessionId: string,
    // ): Promise<ChatCompletionRequestMessage[]> {
    //   const sessionData = await this.getSession(sessionId);
    //   return sessionData.messages;
    // }
    async getSession(sessionId) {
        const sessionKey = this.getSessionKey(sessionId);
        const sessionData = await this.client.get(sessionKey);
        if (!sessionData) {
            throw new Error(`Session ${sessionId} not found`);
        }
        return JSON.parse(sessionData);
    }
}
exports.HistoryStorage = HistoryStorage;
