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
