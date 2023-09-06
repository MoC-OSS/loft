"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = exports.MessageType = void 0;
const uuid_1 = require("uuid");
const helpers_1 = require("../helpers");
var MessageType;
(function (MessageType) {
    MessageType["INJECTION"] = "injection";
    MessageType["EMBEDDING"] = "embedding";
})(MessageType || (exports.MessageType = MessageType = {}));
class Message {
    id;
    author;
    citationMetadata;
    content;
    name;
    tags;
    customProperties;
    isArchived;
    createdAt;
    updatedAt;
    constructor(msg) {
        const timestamp = (0, helpers_1.getTimestamp)();
        this.id = msg.id || (0, uuid_1.v4)();
        this.author = msg.author || 'user';
        this.content = msg.content;
        this.name = msg.name;
        this.tags = msg.tags || [];
        this.customProperties = msg.customProperties || {};
        this.isArchived = msg.isArchived || false;
        this.createdAt = msg.createdAt || timestamp;
        this.updatedAt = msg.updatedAt || timestamp;
    }
    toJSON() {
        return {
            id: this.id,
            author: this.author,
            citationMetadata: this.citationMetadata,
            content: this.content,
            name: this.name,
            tags: this.tags,
            customProperties: this.customProperties,
            isArchived: this.isArchived,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
    //use to filter out additional fields
    formatToLLM() {
        if (this.isArchived === true)
            return undefined;
        const message = {
            author: this.author,
            content: this.content,
            citationMetadata: this.citationMetadata,
        };
        return JSON.parse(JSON.stringify(message)); //delete undefined fields
    }
}
exports.Message = Message;
