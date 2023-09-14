import { v4 as uuid } from 'uuid';
import { getTimestamp } from '../helpers';
export var MessageType;
(function (MessageType) {
    MessageType["INJECTION"] = "injection";
    MessageType["EMBEDDING"] = "embedding";
})(MessageType || (MessageType = {}));
export class Message {
    id;
    author;
    citationMetadata;
    content;
    name;
    // function_call?: ChatCompletionRequestMessageFunctionCall;
    // type?: MessageType | null;
    tags;
    customProperties;
    isArchived;
    createdAt;
    updatedAt;
    constructor(msg) {
        const timestamp = getTimestamp();
        this.id = msg.id || uuid();
        this.author = msg.author || 'user';
        this.content = msg.content;
        this.name = msg.name;
        // this.function_call = msg.function_call;
        // this.type = msg.type;
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
            // function_call: this.function_call,
            // type: this.type,
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
//# sourceMappingURL=Message.js.map