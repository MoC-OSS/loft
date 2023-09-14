import pino from 'pino';
import chalk from 'chalk';
import { Queue, Worker } from 'bullmq';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { v4 } from 'uuid';
import { PredictionServiceClient, helpers } from '@google-cloud/aiplatform';
import { S3Client, GetObjectCommand, S3ServiceException, PutObjectCommand } from '@aws-sdk/client-s3';
import { Storage } from '@google-cloud/storage';

var ChatCompletionCallInitiator;
(function (ChatCompletionCallInitiator) {
    ChatCompletionCallInitiator["main_flow"] = "MAIN_FLOW";
    ChatCompletionCallInitiator["injection"] = "INJECTION";
    ChatCompletionCallInitiator["call_again"] = "CALL_AGAIN";
    ChatCompletionCallInitiator["set_function_result"] = "SET_FUNCTION_RESULT";
})(ChatCompletionCallInitiator || (ChatCompletionCallInitiator = {}));
var MiddlewareStatus;
(function (MiddlewareStatus) {
    MiddlewareStatus["CONTINUE"] = "CONTINUE";
    MiddlewareStatus["CALL_AGAIN"] = "CALL_AGAIN";
    MiddlewareStatus["NOT_RETURNED"] = "NOT_RETURNED";
    MiddlewareStatus["STOP"] = "STOP";
})(MiddlewareStatus || (MiddlewareStatus = {}));

// import * as dotenv from 'dotenv';
// dotenv.config();
let loggerOptions = {
    enabled: true,
    timestamp: true,
    level: 'error',
};
let transport;
if (process.env.LLM_ORCHESTRATOR_ENV === 'development') {
    loggerOptions = {
        enabled: true,
        timestamp: true,
        level: 'trace',
    };
    transport = pino.transport({
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'UTC:yyyy-mm-dd HH:MM:ss.l o',
            crlf: true,
            levelFirst: true,
            timestampKey: 'time',
            ignore: 'pid,hostname,path',
            messageFormat: `${chalk.magentaBright('[{path}] [sessionId: {sessionId}, systemMessage: {systemMessageName}]')} {msg}`,
        },
    });
}
const baseLogger = pino(loggerOptions, transport);
function getLogger(name) {
    // const pathToFile = path.relative(process.cwd(), name); // const l = getLogger(__dirname);
    return baseLogger.child({
        path: name,
    });
}

const l$c = getLogger('EventManager');
class EventManager {
    sessionStorage;
    errorHandler;
    eventHandlers;
    defaultEventHandler;
    constructor(sessionStorage, errorHandler) {
        this.sessionStorage = sessionStorage;
        this.errorHandler = errorHandler;
        l$c.info('EventManager initialization...');
        this.defaultEventHandler = async () => {
            l$c.error('LLM Event not detected. Library try to continue with DefaultEventHandler, but it is not defined. Please define using useDefaultHandler(response: string): Promise<void> to receive the response.');
        };
        this.eventHandlers = new Map();
    }
    use(name, eventHandler) {
        if (this.eventHandlers.has(name)) {
            throw new Error(`An event handler with the name "${name}" already exists.`);
        }
        // Set a default value for maxLoops if it's not set
        if (eventHandler.maxLoops === undefined) {
            eventHandler.maxLoops = 10; // default value
        }
        // Set a default value for priority if it's not set
        if (!eventHandler.priority) {
            eventHandler.priority = 0; // default value
        }
        l$c.info(`Registered event handler with the name "${name}". Priority: ${eventHandler.priority}. Max Loops: ${eventHandler.maxLoops}.`);
        this.eventHandlers.set(name, eventHandler);
    }
    useDefault(eventHandler) {
        l$c.info(`Registered default EventHandler.`);
        this.defaultEventHandler = eventHandler;
    }
    async executeEventHandlers(response) {
        let eventHandlersIterator = this.eventHandlers.entries();
        let currentEventHandlerEntry = eventHandlersIterator.next();
        let triggeredEvents = [];
        try {
            const next = async () => {
                if (currentEventHandlerEntry.done)
                    return;
                let [name, eventHandler] = currentEventHandlerEntry.value;
                currentEventHandlerEntry = eventHandlersIterator.next();
                try {
                    const trigger = await eventHandler.eventDetector(response, next);
                    if (trigger) {
                        triggeredEvents.push({ name, priority: eventHandler.priority });
                    }
                }
                catch (error) {
                    l$c.error(`Error occurred in eventDetector of event handler ${name}: ${error}`);
                    throw error;
                }
            };
            await next();
            // if no event handler was triggered, execute the default event handler
            if (triggeredEvents.length === 0)
                return this.defaultEventHandler(response);
            triggeredEvents.sort((a, b) => b.priority - a.priority);
            if (triggeredEvents.length > 0) {
                const { name } = triggeredEvents[0];
                const eventHandler = this.eventHandlers.get(name);
                if (eventHandler) {
                    try {
                        // tracking the number of times an event handler is called
                        const { sessionId, systemMessageName } = response.session;
                        if (response.initiator === ChatCompletionCallInitiator.call_again)
                            await this.sessionStorage.incrementHandlerCount(sessionId, systemMessageName, name);
                        response.session = await this.sessionStorage.getSession(sessionId, systemMessageName);
                        // over-loop handler prevention
                        const { handlersCount } = response.session;
                        if (handlersCount[name] >= eventHandler.maxLoops)
                            return this.errorHandler(new Error(`Max Loops Reached, handler: ${name}, maxLoops: ${eventHandler.maxLoops}, counted maxLoops: ${handlersCount[name]}. Please check your event handlers or if your flow requires it, increase maxLoops property of the event handler to a higher value.`), response);
                        await eventHandler.handler(response, () => Promise.resolve());
                    }
                    catch (error) {
                        this.errorHandler(error, response);
                        throw error;
                    }
                }
            }
        }
        catch (error) {
            l$c.error(`Error occurred while executing event handlers: ${error}`);
        }
    }
}

const l$b = getLogger('LlmIOManager');
class LlmIOManager {
    llmInputMiddlewareChain = new Map();
    llmOutputMiddlewareChain = new Map();
    constructor() {
        l$b.info('LlmIOManager initialization...');
    }
    useInput(name, middleware) {
        if (this.llmInputMiddlewareChain.has(middleware.name)) {
            throw new Error(`A input middleware with the name "${name}" already exists.`);
        }
        l$b.info(`Registered input middleware with the name "${name}".`);
        this.llmInputMiddlewareChain.set(name, middleware);
    }
    useOutput(name, middleware) {
        if (this.llmOutputMiddlewareChain.has(middleware.name)) {
            throw new Error(`A output middleware with the name "${name}" already exists.`);
        }
        l$b.info(`Registered output middleware with the name "${name}".`);
        this.llmOutputMiddlewareChain.set(name, middleware);
    }
    async executeInputMiddlewareChain(inputContext) {
        if (this.llmInputMiddlewareChain.size === 0) {
            return inputContext;
        }
        const { sessionId, systemMessageName } = inputContext;
        l$b.info(`sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - Executing input middleware chain`);
        let middlewaresIterator = this.llmInputMiddlewareChain.entries();
        let currentMiddlewareEntry = middlewaresIterator.next();
        let modifiedContext = { ...inputContext };
        try {
            const next = async (modifiedInputContext) => {
                if (currentMiddlewareEntry.done)
                    return;
                let [name, middleware] = currentMiddlewareEntry.value;
                currentMiddlewareEntry = middlewaresIterator.next();
                try {
                    l$b.info(`sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - Executing middleware: ${name}...`);
                    // TODO: need refactor middleware. each middleware should return modified context to check type of context
                    await middleware(modifiedInputContext, (nextInputContext) => {
                        modifiedContext = { ...nextInputContext };
                        return next(modifiedContext);
                    });
                }
                catch (error) {
                    l$b.error(`Error occurred in middleware ${name}: ${error}`);
                    throw error;
                }
            };
            await next(inputContext);
        }
        catch (error) {
            l$b.error(`Error occurred while executing middleware chain by sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - ${error}`);
        }
        return modifiedContext;
    }
    async executeOutputMiddlewareChain(outputContext) {
        if (this.llmOutputMiddlewareChain.size === 0) {
            return [MiddlewareStatus.CONTINUE, outputContext];
        }
        const { sessionId, systemMessageName } = outputContext.session;
        l$b.info(`sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - Executing output middleware chain`);
        let middlewaresIterator = this.llmOutputMiddlewareChain.entries();
        let currentMiddlewareEntry = middlewaresIterator.next();
        let modifiedContext = { ...outputContext };
        const middlewareStatuses = [];
        try {
            const next = async (modifiedOutputContext) => {
                if (currentMiddlewareEntry.done)
                    return;
                let [name, middleware] = currentMiddlewareEntry.value;
                currentMiddlewareEntry = middlewaresIterator.next();
                try {
                    l$b.info(`sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - Executing middleware: ${name}...`);
                    const { status, newOutputContext } = await middleware(modifiedOutputContext, (nextIOContext) => {
                        modifiedContext = { ...nextIOContext };
                        return next(modifiedContext);
                    });
                    middlewareStatuses.push({
                        name,
                        status: status || MiddlewareStatus.NOT_RETURNED,
                    });
                    if (status === MiddlewareStatus.CALL_AGAIN ||
                        status === MiddlewareStatus.STOP) {
                        return;
                    }
                    else if (newOutputContext && status === MiddlewareStatus.CONTINUE) {
                        return next(newOutputContext);
                    }
                }
                catch (error) {
                    l$b.error(`Error occurred in middleware ${name}: ${error}`);
                    throw error;
                }
            };
            await next(outputContext);
        }
        catch (error) {
            l$b.error(`Error occurred while executing middleware chain: ${error}`);
        }
        l$b.info(`sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - Middleware statuses: ${middlewareStatuses}`);
        const isCallAgain = middlewareStatuses.some(({ status }) => status.includes(MiddlewareStatus.CALL_AGAIN) ||
            status.includes(MiddlewareStatus.STOP));
        modifiedContext.session.save();
        if (isCallAgain) {
            l$b.info(`sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - LLM Response handling will not be finished. Because one of Output Middlewares returned status: ${MiddlewareStatus.CALL_AGAIN} | ${MiddlewareStatus.STOP}, which means that the Output Middlewares chain will be executed again in the next iteration.`);
            return [MiddlewareStatus.CALL_AGAIN, modifiedContext];
        }
        else {
            l$b.info(`sessionId: ${sessionId}, systemMessageName: ${systemMessageName} - LLM Response successfully handled by Output Middlewares. and will will be passed to EventManager handlers.`);
            return [MiddlewareStatus.CONTINUE, modifiedContext];
        }
    }
}

const redisKeyRegex = /^[a-zA-Z0-9:_\.-]*$/;
function getTimestamp() {
    return DateTime.local().toUTC().toSeconds();
}
function sanitizeAndValidateRedisKey(key) {
    // Regular expression to test key
    // This expression will allow alphanumeric characters (a-z, A-Z, 0-9) and the specified symbols (: . - _)
    const sanitizedKey = key.replace(/[\n\r\t\b]/g, '');
    if (redisKeyRegex.test(key)) {
        return sanitizedKey;
    }
    else {
        throw new Error('Invalid Redis key. Allowed only alphanumeric characters (a-z, A-Z, 0-9) and the specified symbols (: . - _)`');
    }
}
function deepEqual(obj1, obj2) {
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
        if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) {
            return false;
        }
    }
    return true;
}
function isNotUndefined(value) {
    return value !== undefined;
}
// A function to get the content of a choice by index
function getContentOfChoiceByIndex(ctx, index = 0) {
    return ctx.llmResponse?.candidates[index].content;
}
// A function to modify the content of a choice by index
function modifyContentOfChoiceByIndex(ctx, index, newContent) {
    const choiceMessage = ctx.llmResponse?.candidates[index];
    if (choiceMessage) {
        choiceMessage.content = newContent;
    }
}

const ChatCompletionInputSchema = z.object({
    systemMessageName: z
        .string()
        .refine((name) => redisKeyRegex.test(name), 'Invalid systemMessages.name value. Allowed only alphanumeric characters (a-z, A-Z, 0-9) and the specified symbols (: . - _)'),
    message: z.string(),
    sessionId: z
        .string()
        .refine((name) => redisKeyRegex.test(name), 'Invalid systemMessages.name value. Allowed only alphanumeric characters (a-z, A-Z, 0-9) and the specified symbols (: . - _)'),
    intent: z.string(),
});

var MessageType;
(function (MessageType) {
    MessageType["INJECTION"] = "injection";
    MessageType["EMBEDDING"] = "embedding";
})(MessageType || (MessageType = {}));
class Message {
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
        this.id = msg.id || v4();
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

const l$a = getLogger('ChatHistoryQueryEngine');
class QueryByArrayOfObjects extends Array {
    constructor(...items) {
        super(...items);
        l$a.info(`ChatHistoryQueryEngine initialization...`);
    }
    query(query) {
        l$a.info(`query: ${JSON.stringify(query)}`);
        return this.filter((item) => this.evaluate(item, query));
    }
    evaluate(item, query) {
        if ('$and' in query ||
            '$or' in query ||
            '$nor' in query ||
            '$not' in query) {
            const operator = Object.keys(query)[0];
            const values = query[operator];
            if (!values)
                return true;
            switch (operator) {
                case '$and':
                    return values.every((value) => this.evaluate(item, value));
                case '$or':
                    return values.some((value) => this.evaluate(item, value));
                case '$nor':
                    return !values.some((value) => this.evaluate(item, value));
                case '$not':
                    return !values.every((value) => this.evaluate(item, value));
                default:
                    throw new Error(`Invalid operator: ${operator}`);
            }
        }
        else {
            for (let key in query) {
                const conditions = query[key];
                const fieldValue = item[key];
                if ('$eq' in conditions ||
                    '$ne' in conditions ||
                    '$gt' in conditions ||
                    '$gte' in conditions ||
                    '$lt' in conditions ||
                    '$lte' in conditions ||
                    '$in' in conditions ||
                    '$contains' in conditions ||
                    '$regex' in conditions) {
                    const opConditions = conditions;
                    for (let op in opConditions) {
                        const condition = opConditions[op];
                        switch (op) {
                            case '$eq':
                                if (fieldValue !== condition)
                                    return false;
                                break;
                            case '$ne':
                                if (fieldValue === condition)
                                    return false;
                                break;
                            case '$gt':
                                if (fieldValue <= condition)
                                    return false;
                                break;
                            case '$gte':
                                if (fieldValue < condition)
                                    return false;
                                break;
                            case '$lt':
                                if (fieldValue >= condition)
                                    return false;
                                break;
                            case '$lte':
                                if (fieldValue > condition)
                                    return false;
                                break;
                            case '$in':
                                if (!condition.includes(fieldValue))
                                    return false;
                                break;
                            case '$contains':
                                if (typeof fieldValue === 'string' &&
                                    fieldValue.indexOf(condition) === -1)
                                    return false;
                                break;
                            case '$regex':
                                if (typeof fieldValue === 'string' &&
                                    !condition.test(fieldValue))
                                    return false;
                                break;
                            default:
                                throw new Error(`Invalid operator: ${op}`);
                        }
                    }
                }
                else if (typeof fieldValue === 'object' && fieldValue !== null) {
                    if (!this.evaluate(fieldValue, conditions))
                        return false;
                }
            }
        }
        return true;
    }
    // fix that prevent call empty constructor when use map, filter, etc.
    static get [Symbol.species]() {
        return Array;
    }
}

const logger = getLogger('ChatHistory');
const l$9 = Symbol('logger');
class ChatHistory extends QueryByArrayOfObjects {
    [l$9]; // this Symbol property for exclude logger from built-in Array methods of instance
    constructor(sessionId, systemMessageName, ...items) {
        super(...items.map((item) => new Message(item)));
        this[l$9] = logger.child({ sessionId, systemMessageName });
        this[l$9].info(`ChatHistory initialization...`);
    }
    append(message) {
        this[l$9].info(`append new message`);
        this.push(message);
    }
    // partial update by id
    updateById(id, newData) {
        this[l$9].info(`update message with id: ${id}`);
        const index = this.findIndex((message) => message.id === id);
        if (index === -1) {
            throw new Error(`Message with id "${id}" not found`);
        }
        this[index] = new Message(Object.assign({}, this[index], newData));
    }
    archiveById(id) {
        this[l$9].info(`archive message with id: ${id}`);
        this.updateById(id, { isArchived: true });
    }
    deleteById(id) {
        this[l$9].info(`delete message by id: ${id}`);
        const index = this.findIndex((message) => message.id === id);
        if (index === -1) {
            throw new Error(`Message with id "${id}" not found`);
        }
        this.splice(index, 1);
    }
    appendAfterMessageId(message, id) {
        this[l$9].info(`append message after message by id: ${id}`);
        const index = this.findIndex((message) => message.id === id);
        if (index === -1) {
            throw new Error(`Message with id "${id}" not found`);
        }
        this.splice(index + 1, 0, message);
    }
    replaceById(id, message) {
        this[l$9].info(`replace message by id: ${id}`);
        const index = this.findIndex((message) => message.id === id);
        if (index === -1) {
            throw new Error(`Message with id "${id}" not found`);
        }
        this[index] = message;
    }
    replaceAll(messages) {
        this[l$9].info(`replace all messages`);
        this.length = 0;
        this.push(...messages);
        return this;
    }
    formatToLLM() {
        this[l$9].info(`format messages to LLM format`);
        let messages = this.map((message) => message.formatToLLM()).filter(isNotUndefined);
        return messages;
    }
}

const l$8 = getLogger('Session');
class Session {
    sessionStorage;
    sessionId;
    systemMessageName;
    systemMessage;
    model;
    modelPreset;
    messages;
    examples;
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
        this.systemMessage = sessionData.systemMessage;
        l$8.info(`${this.logPrefix()} Session initialization...`);
        this.model = sessionData.model;
        this.modelPreset = sessionData.modelPreset;
        this.messages = new ChatHistory(sessionData.sessionId, sessionData.systemMessageName, ...sessionData.messages);
        this.examples = sessionData.examples;
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
        l$8.info(`${this.logPrefix()} - save session`);
        return this.sessionStorage.save(this);
    }
    async delete() {
        l$8.info(`${this.logPrefix()} - delete session`);
        this.sessionStorage.deleteSession(this.sessionId, this.systemMessageName);
    }
    toJSON() {
        return {
            sessionId: this.sessionId,
            systemMessageName: this.systemMessageName,
            systemMessage: this.systemMessage,
            model: this.model,
            modelPreset: this.modelPreset,
            messages: this.messages,
            examples: this.examples,
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

// const palm = new Palm('gcp-project-name', 'model-name');
//   const instance: PredictionInstance = {
//     context: 'My name is Miles. You are an astronomer, knowledgeable about the solar system.',
//     examples: [
//       { input: { content: 'How many moons does Mars have?' }, output: { content: 'The planet Mars has two moons, Phobos and Deimos.' } }
//     ],
//     messages: [
//       { author: 'user', content: 'How many planets are there in the solar system?' }
//     ]
//   };
class Palm {
    project;
    apiEndpoint;
    location;
    publisher;
    predictionServiceClient;
    constructor(project, apiEndpoint = 'us-central1-aiplatform.googleapis.com', location = 'us-central1', publisher = 'google') {
        this.project = project;
        this.apiEndpoint = apiEndpoint;
        this.location = location;
        this.publisher = publisher;
        const clientOptions = {
            apiEndpoint: this.apiEndpoint,
        };
        this.predictionServiceClient = new PredictionServiceClient(clientOptions);
    }
    getEndpoint(model) {
        return `projects/${this.project}/locations/${this.location}/publishers/${this.publisher}/models/${model}`;
    }
    async callPredict(instance, parameters, model = 'chat-bison@001') {
        const endpoint = this.getEndpoint(model);
        const request = {
            endpoint,
            instances: [helpers.toValue(instance)],
            parameters: helpers.toValue(parameters),
        };
        try {
            const [response] = await this.predictionServiceClient.predict(request);
            let resData = response.predictions;
            const result = {
                predictions: resData.map((element) => {
                    return helpers.fromValue(element);
                }),
                metadata: helpers.fromValue(response.metadata),
            };
            return result;
        }
        catch (error) {
            console.error(`Error occurred during prediction: ${error}`);
            throw error;
        }
    }
}

const l$7 = getLogger('ChatCompletion');
class ChatCompletion {
    cfg;
    sms;
    ps;
    hs;
    errorHandler;
    eventManager;
    llmIOManager;
    llm;
    completionQueue;
    completionWorker;
    llmApiCallQueue;
    llmApiCallWorker;
    constructor(cfg, sms, ps, hs, errorHandler) {
        this.cfg = cfg;
        this.sms = sms;
        this.ps = ps;
        this.hs = hs;
        this.errorHandler = errorHandler;
        this.eventManager = new EventManager(this.hs, this.errorHandler);
        this.llmIOManager = new LlmIOManager();
        this.llm = new Palm('master-of-code-sandbox');
        l$7.info('ChatCompletion: completionQueue initialization...');
        this.completionQueue = new Queue('chatCompletionQueue', {
            connection: {
                host: this.cfg.redisHost,
                port: this.cfg.redisPort,
                db: this.cfg.bullMqDb,
            },
        });
        l$7.info('ChatCompletion: completionWorker definition...');
        this.completionWorker = new Worker('chatCompletionQueue', async (job) => this.chatCompletionBeginProcessor(job), {
            connection: {
                host: this.cfg.redisHost,
                port: this.cfg.redisPort,
                db: this.cfg.bullMqDb,
            },
            autorun: false,
            lockDuration: this.cfg.jobsLockDuration || 60000, // 1 minute by default
        });
        l$7.info('ChatCompletion: llmApiCallQueue initialization...');
        this.llmApiCallQueue = new Queue('llmApiCallQueue', {
            connection: {
                host: this.cfg.redisHost,
                port: this.cfg.redisPort,
                db: this.cfg.bullMqDb,
            },
        });
        l$7.info('ChatCompletion: llmApiCallWorker definition...');
        this.llmApiCallWorker = new Worker('llmApiCallQueue', async (job) => this.chatCompletionCallProcessor(job), {
            limiter: {
                max: this.cfg.llmRateLimiter.max,
                duration: this.cfg.llmRateLimiter.duration,
            },
            concurrency: this.cfg.llmRateLimiter.concurrency,
            connection: {
                host: this.cfg.redisHost,
                port: this.cfg.redisPort,
                db: this.cfg.bullMqDb,
            },
            autorun: false,
            lockDuration: this.cfg.jobsLockDuration || 60000, // 1 minute by default
        });
        this.completionWorker.on('error', this.errorHandler);
        this.llmApiCallWorker.on('error', this.errorHandler);
    }
    static async createInstance(cfg, sms, ps, hs, errorHandler) {
        l$7.info('Creating ChatCompletion instance...');
        const instance = new ChatCompletion(cfg, sms, ps, hs, errorHandler);
        await instance.initialize();
        return instance;
    }
    async initialize() {
        l$7.info('Initializing ChatCompletion instance...');
        l$7.info('Syncing system messages and prompts...');
        await this.syncSystemMessagesAndPrompts();
        l$7.info('Starting chatCompletionBeginProcessor worker...');
        this.completionWorker.run(); // run the worker after sync systemMessages
        l$7.info('Starting chatCompletionCallProcessor worker...');
        this.llmApiCallWorker.run();
        l$7.info('ChatCompletion instance initialized successfully!');
    }
    async call(data) {
        try {
            l$7.info(`chatCompletion: received input with sessionId: ${data.sessionId}`);
            l$7.info(`chatCompletion: validating input...`);
            const chatData = ChatCompletionInputSchema.parse(data);
            const message = new Message({
                author: 'user',
                content: chatData.message,
            });
            const chatInputPayload = {
                sessionId: chatData.sessionId,
                systemMessageName: chatData.systemMessageName,
                messages: [message],
            };
            l$7.info(`chatCompletion: creating job key...`);
            const jobKey = sanitizeAndValidateRedisKey(`app:${this.cfg.appName}:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_begin_processor:intent:processing_new_or_existing_session:session:${chatData.sessionId}:system_message:${chatData.systemMessageName}:time:${getTimestamp()}`);
            l$7.info(`chatCompletion: job key created: ${jobKey}`);
            l$7.info(`chatCompletion: adding job to queue...`);
            await this.completionQueue.add(jobKey, chatInputPayload, {
                removeOnComplete: true,
                attempts: this.cfg.jobsAttempts,
            });
        }
        catch (error) {
            l$7.error(`Error occurred in ChatCompletion class when calling chatCompletion method: `, error);
        }
    }
    async injectPromptAndSend(promptName, session, messages, promptRole) {
        const { sessionId, systemMessageName } = session;
        l$7.info(`injecting prompt: ${promptName}, sessionId: ${sessionId}, systemMessageName: ${systemMessageName}`);
        if (!(await this.hs.isExists(sessionId, systemMessageName)))
            throw new Error("inject prompt failed: sessionId doesn't exist");
        const prevSession = await this.hs.getSession(sessionId, systemMessageName);
        const promptData = await this.ps.computePrompt(promptName, prevSession);
        const userPrompt = new Message({
            author: promptRole,
            content: promptData.prompt,
        });
        const processedInputContext = await this.llmIOManager.executeInputMiddlewareChain({
            sessionId,
            systemMessageName,
            messages,
        });
        const lastPrompt = prevSession.messages[prevSession.messages.length - 2];
        const lastUserMessage = prevSession.messages[prevSession.messages.length - 1];
        const ifLastPromptIsLikeCurrentPrompt = lastPrompt.content === promptData.prompt;
        const ifLastUserMessageIsLikeCurrentUserMessage = lastUserMessage.content ===
            processedInputContext.messages[processedInputContext.messages.length - 1]
                .content;
        const isHistoryDuplicate = ifLastPromptIsLikeCurrentPrompt &&
            ifLastUserMessageIsLikeCurrentUserMessage;
        // if last prompt and user message is the same as the current message, don't update history and return
        if (isHistoryDuplicate) {
            const error = new Error(`
        sessionId: ${sessionId}.
        PromptName: ${promptName}.
        History duplicate detected.
        Row will be skipped.
        Thats can be result of not expected error related to mistakes in S3 files, Prompt callbacks or other related logic.
        Method injectPromptAndSend() will be skipped. and chat flow interrupted.`);
            throw error;
        }
        await this.hs.appendMessages(sessionId, systemMessageName, [
            userPrompt,
            ...processedInputContext.messages,
        ]);
        // await this.hs.appendMessages(sessionId, systemMessageName, [newMessage]);
        const newSession = await this.hs.getSession(sessionId, systemMessageName);
        const jobKey = sanitizeAndValidateRedisKey(`app:${this.cfg.appName}:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_call_processor:intent:injection:session:${sessionId}:system_message:${systemMessageName}:time:${getTimestamp()}`);
        await this.llmApiCallQueue.add(jobKey, { session: newSession }, { attempts: this.cfg.chatCompletionJobCallAttempts });
    }
    /**
     * Use this method when you need to call LLM API again OR after error to continue chat flow.
     * AND only if last message at ChatHistory is user role
     *
     * @param sessionId
     * @param systemMessageName
     */
    async callRetry(sessionId, systemMessageName) {
        let session = await this.hs.getSession(sessionId, systemMessageName);
        if (!(session.messages[session.messages.length - 1].author === 'user')) {
            throw new Error(`Last message in history is not "user" or "function" role,
        callRetry() is not recommended to use in this case.
        Because it can cause unexpected behavior, or corrupt the history.
        Please fix session.messages and call callRetry() again.
        Or use call() method with user message instead.`);
        }
        if (session.lastError) {
            session.lastError = null;
            session = await this.hs.save(session);
        }
        const jobKey = sanitizeAndValidateRedisKey(`app:${this.cfg.appName}:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_call_processor:intent:call_again:session:${sessionId}:system_message:${systemMessageName}:time:${getTimestamp()}`);
        await this.llmApiCallQueue.add(jobKey, { session: session }, { attempts: this.cfg.chatCompletionJobCallAttempts });
        return {
            status: MiddlewareStatus.CALL_AGAIN,
            newOutputContext: undefined,
        };
    }
    async deleteSessionsById(sessionId) {
        await this.hs.deleteSessionsById(sessionId);
    }
    async syncSystemMessagesAndPrompts() {
        await this.sms.syncSystemMessages();
        await this.ps.syncPrompts();
    }
    useComputeSystemMessage(name, handler) {
        this.sms.use(name, handler);
    }
    useComputePrompt(name, handler) {
        this.ps.use(name, handler);
    }
    useDefaultHandler(eventHandler) {
        this.eventManager.useDefault(eventHandler);
    }
    useEventHandler(name, eventHandler) {
        this.eventManager.use(name, eventHandler);
    }
    useLLMInput(name, middleware) {
        this.llmIOManager.useInput(name, middleware);
    }
    useLLMOutput(name, middleware) {
        this.llmIOManager.useOutput(name, middleware);
    }
    getChatCompletionInitiatorName(redisKey) {
        const segments = redisKey.split(':');
        const intentIndex = segments.indexOf('intent');
        let initiator = segments[intentIndex + 1];
        if (!initiator)
            throw new Error('intent is undefined');
        initiator =
            ChatCompletionCallInitiator[initiator];
        if (!initiator) {
            throw new Error('Invalid intent');
        }
        return initiator;
    }
    async chatCompletionCallProcessor(job) {
        let session = new Session(this.hs, job.data.session);
        const { sessionId, systemMessageName, messages, modelPreset } = session;
        const logPrefix = `sessionId: ${sessionId}, systemMessageName: ${systemMessageName} -`;
        l$7.info(`${logPrefix} getting chat completion initiator name...`);
        let initiator = this.getChatCompletionInitiatorName(job.name);
        try {
            l$7.info(`${logPrefix} chat completion initiator name: ${initiator}`);
            l$7.info(`${logPrefix} getting chat completion LLM response...`);
            const chatCompletion = await this.llm.callPredict({
                context: session.systemMessage,
                examples: session.examples,
                messages: session.messages.formatToLLM(),
            }, session.modelPreset);
            const ccm = chatCompletion.predictions[0].candidates[0];
            if (ccm === undefined)
                throw new Error('LLM API response is empty');
            l$7.info(`${logPrefix} executing output middlewares...`);
            let [status, outputContext] = await this.llmIOManager.executeOutputMiddlewareChain({
                session: session,
                llmResponse: chatCompletion.predictions[0],
                initiator,
            });
            /* Cancel job and history update because in middleware was called callAgain()
             LlmOrchestrator.callAgain() will change last user message in history
             add new job to llmApiCallQueue to recall LLM API
            */
            if (status === MiddlewareStatus.CALL_AGAIN ||
                status === MiddlewareStatus.STOP) {
                l$7.info(`${logPrefix} middleware status: ${status}, job canceled.`);
                return;
            }
            const responseMessage = new Message({
                content: ccm.content,
                author: ccm.author,
            });
            await this.hs.appendMessages(sessionId, systemMessageName, [
                responseMessage,
            ]);
            session = await this.hs.getSession(sessionId, systemMessageName);
            l$7.info(`${logPrefix} executing event handlers...`);
            await this.eventManager.executeEventHandlers({
                ...outputContext,
                session,
                initiator,
            });
            l$7.info(`${logPrefix} event handlers executed successfully!`);
            await this.releaseAccToChatQueue(session.sessionId, session.systemMessageName);
        }
        catch (error) {
            l$7.error(error);
            l$7.error(`${logPrefix} check attempts... jobAttempts: ${job.opts.attempts}, of ${this.cfg.chatCompletionJobCallAttempts} provided attempts`);
            if (job.opts.attempts &&
                job.opts.attempts >= this.cfg.chatCompletionJobCallAttempts) {
                session.lastError = JSON.stringify(error);
                await session.save();
                await this.errorHandler(error, { initiator, session });
            }
            throw error;
        }
    }
    releaseAccToChatQueue = async (sessionId, systemMessageName) => {
        const logPrefix = `sessionId: ${sessionId}, systemMessageName: ${systemMessageName} -`;
        const session = await this.hs.getSession(sessionId, systemMessageName);
        try {
            l$7.info(`${logPrefix} checking and handling messageAccumulator...`);
            if (session.messageAccumulator && session.messageAccumulator.length > 0) {
                l$7.info(`chatCompletion: creating job key...`);
                const jobKey = sanitizeAndValidateRedisKey(`app:${this.cfg.appName}:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_begin_processor:intent:processing_new_or_existing_session:session:${session.sessionId}:system_message:${session.systemMessageName}:time:${getTimestamp()}`);
                l$7.info(`chatCompletion: job key created: ${jobKey}`);
                l$7.info(`chatCompletion: adding job to queue...`);
                await this.completionQueue.add(jobKey, {
                    sessionId,
                    systemMessageName,
                    messages: session.messageAccumulator,
                }, {
                    removeOnComplete: true,
                    attempts: this.cfg.jobsAttempts,
                });
                l$7.info(`${logPrefix} job added to queue successfully!`);
                l$7.info(`${logPrefix} clearing messageAccumulator...`);
                session.messageAccumulator = null;
                l$7.info(`${logPrefix} clearing lastError...`);
                session.lastError = null;
                l$7.info(`${logPrefix} saving session...`);
                await session.save();
            }
            else {
                l$7.info(`${logPrefix} messageAccumulator is empty, set null to acc as flag that session is not processing...`);
                session.messageAccumulator = null;
                session.lastError = null;
                l$7.info(`${logPrefix} saving session...`);
                await session.save();
            }
        }
        catch (error) {
            l$7.error(error);
            throw error;
        }
    };
    async chatCompletionBeginProcessor(job) {
        const { systemMessageName, sessionId } = job.data;
        const logPrefix = `sessionId: ${sessionId}, systemMessageName: ${systemMessageName} -`;
        try {
            l$7.info(`${logPrefix} begin processing input middlewares`);
            const { messages: processedMessages } = await this.llmIOManager.executeInputMiddlewareChain(job.data);
            l$7.info(`${logPrefix} end processing input middlewares`);
            l$7.info(`${logPrefix} checking session exists...`);
            if (await this.hs.isExists(sessionId, systemMessageName)) {
                const session = await this.hs.getSession(sessionId, systemMessageName);
                l$7.info(`${logPrefix} session exists, checking if message accumulator exists...`);
                if (session.messageAccumulator !== null || session.lastError !== null) {
                    l$7.info(`${logPrefix} message accumulator exists, appending messages to accumulator...`);
                    await this.hs.appendMessagesToAccumulator(sessionId, systemMessageName, processedMessages, session);
                    l$7.info(`${logPrefix} messages appended to accumulator`);
                    if (session.lastError !== null) {
                        l$7.error(`${logPrefix} session lastError exists, calling error handler...
              You must handle this error in your error handler.
              And call ChatCompletion.callRetry() to continue chat flow.
              In other case, chat flow will be interrupted.
              And all new messages will be saved to session.messageAccumulator until ChatCompletion.callRetry() will be successfully finished.
              And after that, all messages from session.messageAccumulator will be added to session.messages and chat flow will be continued.`);
                        await this.errorHandler(session.lastError, {
                            session,
                            initiator: ChatCompletionCallInitiator.main_flow,
                        });
                        l$7.info(`${logPrefix} error handler called, job finished.`);
                    }
                    return;
                }
                else {
                    l$7.info(`${logPrefix} message accumulator doesn't exist, appending messages to ChatHistory and creating empty accumulator...`);
                    await this.hs.appendMessages(sessionId, systemMessageName, processedMessages);
                }
            }
            else {
                l$7.info(`${logPrefix} begin computing system message...`);
                const { systemMessage, model, modelPreset, examples } = await this.sms.computeSystemMessage(systemMessageName, job.data);
                await this.hs.createSession(sessionId, systemMessageName, systemMessage, model, modelPreset, examples, [...processedMessages]);
            }
            const chatSession = await this.hs.getSession(sessionId, systemMessageName);
            const jobKey = sanitizeAndValidateRedisKey(`app:${this.cfg.appName}:api_type:chat_completion:function:bullmq_job:job_name:chat_completion_call_processor:intent:main_flow:session:${chatSession.sessionId}:system_message:${systemMessageName}:time:${getTimestamp()}`);
            await this.llmApiCallQueue.add(jobKey, {
                session: chatSession,
            }, {
                removeOnComplete: true,
                attempts: this.cfg.chatCompletionJobCallAttempts,
            });
        }
        catch (error) {
            l$7.error(error);
            l$7.error(`${logPrefix} check attempts... jobAttempts: ${job.opts.attempts}, `);
            if (job.opts.attempts && job.opts.attempts >= this.cfg.jobsAttempts) {
                if (await this.hs.isExists(sessionId, systemMessageName)) {
                    const session = await this.hs.getSession(sessionId, systemMessageName);
                    session.lastError = JSON.stringify(error);
                    await session.save();
                    await this.errorHandler(error, {
                        session,
                        initiator: ChatCompletionCallInitiator.main_flow,
                    });
                }
                else {
                    await this.errorHandler(error, {
                        initiator: ChatCompletionCallInitiator.main_flow,
                        sessionId: job.data.sessionId,
                        systemMessageName: job.data.systemMessageName,
                        messages: job.data.messages,
                    });
                }
            }
            throw error;
        }
    }
}

const l$6 = getLogger('SystemMessageService');
class SystemMessageService {
    systemMessageStorage;
    s3;
    systemMessageComputers = new Map();
    constructor(systemMessageStorage, s3) {
        this.systemMessageStorage = systemMessageStorage;
        this.s3 = s3;
        l$6.info('SystemMessageService initialization...');
        this.systemMessageStorage = systemMessageStorage;
    }
    use(name, systemMessageComputer) {
        if (this.systemMessageComputers.has(name)) {
            throw new Error(`A systemMessage computer with the name "${name}" already exists.`);
        }
        l$6.info(`Registered systemMessage computer with the name "${name}".`);
        this.systemMessageComputers.set(name, systemMessageComputer);
    }
    async syncSystemMessages() {
        l$6.info('getting systemMessages from S3...');
        const systemMessages = await this.s3.getSystemMessages();
        l$6.info('syncing systemMessages to redis...');
        await this.systemMessageStorage.syncSystemMessages(systemMessages);
    }
    async computeSystemMessage(systemMessageName, context) {
        l$6.info(`getting systemMessage: ${systemMessageName} computer from map...`);
        const systemMessageComputer = this.systemMessageComputers.get(systemMessageName);
        l$6.info(`getting systemMessage: ${systemMessageName} from redis...`);
        const systemMessage = await this.systemMessageStorage.getSystemMessageByName(systemMessageName);
        if (!systemMessage) {
            throw new Error(`SystemMessage with name "${systemMessageName}" does not exist. Please upload SystemMessages with model presets to AWS S3 for sync to Redis and restart the App.`);
        }
        l$6.info(`checking if systemMessage by name: ${systemMessageName} and systemMessageComputer exists...`);
        if (systemMessage && systemMessageComputer) {
            l$6.info(`computing systemMessage: ${systemMessageName} with systemMessageComputer...`);
            return systemMessageComputer(systemMessage, context);
        }
        return systemMessage;
    }
}

const l$5 = getLogger('SystemMessageStorage');
class SystemMessageStorage {
    client;
    constructor(client) {
        l$5.info('SystemMessageStorage initialization...');
        this.client = client;
    }
    async syncSystemMessages(data) {
        l$5.info('syncing systemMessages to redis...');
        const existingNames = new Set();
        const pipeline = this.client.pipeline();
        // Iterate through the ingested SystemMessages and store them in Redis
        data.systemMessages.forEach((p) => {
            pipeline.set(p.name, JSON.stringify(p));
            existingNames.add(p.name);
        });
        // Retrieve the existing names from Redis
        const storedNames = await this.client.keys('*');
        // Find and remove the SystemMessages with names that are missing in the received SystemMessages
        storedNames.forEach((storedName) => {
            if (!existingNames.has(storedName)) {
                pipeline.del(storedName);
            }
        });
        await pipeline.exec();
    }
    async getSystemMessageByName(name) {
        try {
            l$5.info(`getting systemMessage: ${name} from redis...`);
            const data = await this.client.get(name);
            if (data === null || data === undefined)
                return null;
            return JSON.parse(data ?? '');
        }
        catch (error) {
            l$5.error(error);
            throw error;
        }
    }
    async updateSystemMessageByName(name, newSystemMessage) {
        l$5.info(`updating systemMessage: ${name} in redis...`);
        await this.client.set(name, newSystemMessage);
    }
    async deleteSystemMessageByName(name) {
        l$5.info(`deleting systemMessage: ${name} from redis...`);
        await this.client.del(name);
    }
}

const l$4 = getLogger('PromptService');
class PromptService {
    promptStorage;
    s3;
    promptComputers = new Map();
    constructor(promptStorage, s3) {
        this.promptStorage = promptStorage;
        this.s3 = s3;
    }
    use(name, promptComputer) {
        if (this.promptComputers.has(name)) {
            throw new Error(`A PromptComputer with the name "${name}" already exists.`);
        }
        l$4.info(`Registered PromptComputer with the name "${name}".`);
        this.promptComputers.set(name, promptComputer);
    }
    async syncPrompts() {
        l$4.info('getting prompts from S3...');
        const prompts = await this.s3.getPrompts();
        l$4.info('syncing prompts to redis...');
        await this.promptStorage.syncPrompts(prompts);
    }
    async computePrompt(promptName, session) {
        l$4.info(`sessionId: ${session.sessionId} - getting prompt: ${promptName} computer from map...`);
        const promptComputer = this.promptComputers.get(promptName);
        l$4.info(`sessionId: ${session.sessionId} - getting prompt: ${promptName} from redis...`);
        const prompt = await this.promptStorage.getPromptByName(promptName);
        if (!prompt) {
            throw new Error(`Prompt with name "${promptName}" does not exist. Please upload Prompts with model presets to AWS S3 for sync to Redis and restart the App.`);
        }
        l$4.info(`sessionId: ${session.sessionId} - checking if prompt by name: ${promptName} and promptComputer exists...`);
        if (prompt && promptComputer) {
            l$4.info(`sessionId: ${session.sessionId} - computing prompt: ${promptName}...`);
            return promptComputer(prompt, session);
        }
        return prompt;
    }
}

const l$3 = getLogger('PromptStorage');
class PromptStorage {
    client;
    constructor(client) {
        this.client = client;
    }
    async syncPrompts(data) {
        l$3.info('syncing prompts to redis...');
        const existingNames = new Set();
        const pipeline = this.client.pipeline();
        // Iterate through the ingested Prompts and store them in Redis
        data.prompts.forEach((p) => {
            pipeline.set(p.name, JSON.stringify(p));
            existingNames.add(p.name);
        });
        // Retrieve the existing names from Redis
        const storedNames = await this.client.keys('*');
        // Find and remove the Prompts with names that are missing in the received Prompts
        storedNames.forEach((storedName) => {
            if (!existingNames.has(storedName)) {
                pipeline.del(storedName);
            }
        });
        await pipeline.exec();
    }
    async getPromptByName(name) {
        l$3.info(`getting prompt: ${name} from redis...`);
        try {
            const data = await this.client.get(name);
            if (data === null || data === undefined)
                return null;
            return JSON.parse(data ?? '');
        }
        catch (error) {
            l$3.error(error);
            throw error;
        }
    }
    async updatePromptByName(name, prompt) {
        l$3.info(`updating prompt: ${name} in redis...`);
        await this.client.set(name, prompt);
    }
    async deletePromptByName(name) {
        l$3.info(`deleting prompt: ${name} from redis...`);
        await this.client.del(name);
    }
}

const ModelPresetSchema = z.object({
    temperature: z.number(),
    maxOutputTokens: z.number(),
    topP: z.number(),
    topK: z.number(),
});
const ExampleSchema = z.object({
    input: z.object({
        content: z.string(),
    }),
    output: z.object({
        content: z.string(),
    }),
});
const SystemMessageSchema = z.object({
    name: z
        .string()
        .refine((name) => redisKeyRegex.test(name), 'Invalid systemMessages.name value. Allowed only alphanumeric characters (a-z, A-Z, 0-9) and the specified symbols (: . - _)'),
    systemMessage: z.string(),
    examples: z.array(ExampleSchema),
    model: z.string(),
    modelPreset: ModelPresetSchema,
});
const createChatCompletionRequestSchema = z
    .object({
    systemMessages: z.array(SystemMessageSchema),
})
    .strict();

const PromptSchema = z.object({
    prompts: z.array(z.object({
        name: z.string(),
        prompt: z.string(),
    })),
});

const l$2 = getLogger('S3Service');
class S3Service {
    env;
    region;
    bucketName;
    appName;
    client;
    constructor(env, region, bucketName, appName) {
        this.env = env;
        this.region = region;
        this.bucketName = bucketName;
        this.appName = appName;
        l$2.info('S3Service initialization...');
        this.client = new S3Client({ region: this.region });
        l$2.info(`Put Bucket Lifecycle Configuration to error log files...`);
    }
    async getFile(filename) {
        try {
            l$2.info(`getting file: ${filename} from S3...`);
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: filename,
            });
            const response = await this.client.send(command);
            return response.Body;
        }
        catch (err) {
            if (err instanceof S3ServiceException &&
                err.$metadata.httpStatusCode == 404) {
                l$2.warn(`File ${filename} not found!`);
                return null;
            }
            throw err;
        }
    }
    async getSystemMessages() {
        try {
            l$2.info('getting systemMessages from S3...');
            const fileName = `${this.appName}/${this.env}/system_messages.json`;
            const file = await this.getFile(fileName);
            if (file === null || file === undefined) {
                const errorMessage = `File ${fileName} not found!`;
                l$2.error(errorMessage, 'App will be terminated.');
                await this.logToS3(errorMessage);
                process.exit(1);
            }
            l$2.info('parsing systemMessages...');
            const systemMessages = JSON.parse(await file.transformToString());
            l$2.info('validating systemMessages...');
            return createChatCompletionRequestSchema.parse(systemMessages);
        }
        catch (error) {
            l$2.error(error);
            await this.logToS3(error.toString());
            throw error;
        }
    }
    async getPrompts() {
        try {
            l$2.info('getting prompts from S3...');
            const fileName = `${this.appName}/${this.env}/prompts.json`;
            const file = await this.getFile(fileName);
            if (file === null || file === undefined) {
                const errorMessage = `File ${fileName} not found!`;
                l$2.error(errorMessage, 'App will be terminated.');
                await this.logToS3(errorMessage);
                process.exit(1);
            }
            l$2.info('parsing prompts...');
            const prompts = JSON.parse(await file.transformToString());
            l$2.info('validating prompts...');
            return PromptSchema.parse(prompts);
        }
        catch (error) {
            l$2.error(error);
            await this.logToS3(error.toString());
            throw error;
        }
    }
    async logToS3(data) {
        l$2.info('logging error to S3...');
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: `${this.appName}/${this.env}/log_errors.txt`,
            Body: data,
        });
        await this.client.send(command).catch((err) => l$2.error(err));
    }
}

const l$1 = getLogger('GCPStorageService');
class CloudStorageService {
    env;
    bucketName;
    appName;
    storage;
    constructor(env, bucketName, appName) {
        this.env = env;
        this.bucketName = bucketName;
        this.appName = appName;
        l$1.info('GCPStorageService initialization...');
        this.storage = new Storage({});
        l$1.info(`Configured Google Cloud Storage.`);
    }
    async getFile(filename) {
        try {
            l$1.info(`getting file: ${filename} from GCP Storage...`);
            const file = this.storage.bucket(this.bucketName).file(filename);
            const [data] = await file.download();
            return data;
        }
        catch (err) {
            // if (err.code === 404) {
            //   l.warn(`File ${filename} not found!`);
            //   return null;
            // }
            throw err;
        }
    }
    async getSystemMessages() {
        try {
            l$1.info('getting systemMessages from GCP Storage...');
            const fileName = `${this.appName}/${this.env}/system_messages.json`;
            const file = await this.getFile(fileName);
            if (file === null) {
                const errorMessage = `File ${fileName} not found!`;
                l$1.error(errorMessage, 'App will be terminated.');
                await this.logToGCP(errorMessage);
                process.exit(1);
            }
            l$1.info('parsing systemMessages...');
            const systemMessages = JSON.parse(file.toString());
            l$1.info('validating systemMessages...');
            return createChatCompletionRequestSchema.parse(systemMessages);
        }
        catch (error) {
            l$1.error(error);
            await this.logToGCP(error.toString());
            throw error;
        }
    }
    async getPrompts() {
        try {
            l$1.info('getting prompts from GCP Storage...');
            const fileName = `${this.appName}/${this.env}/prompts.json`;
            const file = await this.getFile(fileName);
            if (file === null) {
                const errorMessage = `File ${fileName} not found!`;
                l$1.error(errorMessage, 'App will be terminated.');
                await this.logToGCP(errorMessage);
                process.exit(1);
            }
            l$1.info('parsing prompts...');
            const prompts = JSON.parse(file.toString());
            l$1.info('validating prompts...');
            return PromptSchema.parse(prompts);
        }
        catch (error) {
            l$1.error(error);
            await this.logToGCP(error.toString());
            throw error;
        }
    }
    async logToGCP(data) {
        l$1.info('logging error to GCP Storage...');
        const file = this.storage
            .bucket(this.bucketName)
            .file(`${this.appName}/${this.env}/log_errors.txt`);
        await file.save(data).catch((err) => l$1.error(err));
    }
}

const l = getLogger('SessionStorage');
class SessionStorage {
    client;
    sessionTtl;
    appName;
    constructor(client, sessionTtl, appName) {
        this.client = client;
        this.sessionTtl = sessionTtl;
        this.appName = appName;
        l.info('SessionStorage initialization...');
    }
    getChatCompletionSessionKey(sessionId, systemMessageName) {
        return `app:${this.appName}:api_type:chat_completion:function:session_storage:session:${sessionId}:system_message:${systemMessageName}`;
    }
    async isExists(sessionId, systemMessageName) {
        const sessionKey = this.getChatCompletionSessionKey(sessionId, systemMessageName);
        l.info(`Check session exists by key: ${sessionKey}`);
        const result = await this.client.exists(sessionKey);
        return result === 1;
    }
    async createSession(sessionId, systemMessageName, systemMessage, model, modelPreset, examples, messages) {
        const sessionKey = this.getChatCompletionSessionKey(sessionId, systemMessageName);
        l.info(`Create session by key: ${sessionKey}`);
        const timestamp = getTimestamp();
        const [userMessage] = messages;
        if (!systemMessage && !userMessage) {
            throw new Error("Can't create session without system and user messages");
        }
        const session = new Session(this, {
            sessionId,
            systemMessageName,
            systemMessage,
            model,
            modelPreset,
            messages: messages,
            examples,
            lastMessageByRole: {
                user: userMessage,
                assistant: null,
            },
            handlersCount: {},
            ctx: {},
            messageAccumulator: [],
            createdAt: timestamp,
            updatedAt: timestamp,
            lastError: null,
        });
        await this.client.set(sessionKey, JSON.stringify(session), 'EX', this.sessionTtl);
    }
    async appendMessages(sessionId, systemMessageName, newMessages) {
        try {
            l.info(`Append messages to session ${sessionId}, systemMessageName: ${systemMessageName}`);
            const session = await this.getSession(sessionId, systemMessageName);
            newMessages.forEach((newMessage) => {
                session.messages.push(newMessage);
                session.lastMessageByRole[newMessage.author] = newMessage;
            });
            session.updatedAt = getTimestamp();
            const sessionKey = this.getChatCompletionSessionKey(sessionId, systemMessageName);
            if (!session.messageAccumulator) {
                session.messageAccumulator = [];
            }
            await this.client.set(sessionKey, JSON.stringify(session), 'EX', this.sessionTtl);
        }
        catch (error) {
            l.error(error);
            throw error;
        }
    }
    async appendMessagesToAccumulator(sessionId, systemMessageName, newMessages, session) {
        if (!session) {
            session = await this.getSession(sessionId, systemMessageName);
        }
        if (!session.messageAccumulator) {
            session.messageAccumulator = [];
        }
        session.messageAccumulator.push(...newMessages);
        const sessionKey = this.getChatCompletionSessionKey(sessionId, systemMessageName);
        await this.client.set(sessionKey, JSON.stringify(session), 'EX', this.sessionTtl);
    }
    async deleteSession(sessionId, systemMessageName) {
        const sessionKey = this.getChatCompletionSessionKey(sessionId, systemMessageName);
        l.info(`Delete session by key: ${sessionKey}`);
        await this.client.del(sessionKey);
    }
    async deleteSessionsById(sessionId) {
        l.info(`Delete sessions by id: ${sessionId}`);
        const keys = await this.findKeysByPartialName(sessionId);
        await this.client.del(keys);
    }
    async findKeysByPartialName(partialKey) {
        try {
            l.info(`Find keys by partial name: ${partialKey}`);
            return this.client.keys(`*${partialKey}*`);
        }
        catch (error) {
            l.error(error);
            throw error;
        }
    }
    async incrementHandlerCount(sessionId, systemMessageName, handlerName) {
        l.info(`Increment handler count: ${handlerName}, sessionId: ${sessionId}, systemMessageName: ${systemMessageName}`);
        const session = await this.getSession(sessionId, systemMessageName);
        if (!session.handlersCount[handlerName]) {
            session.handlersCount[handlerName] = 0;
        }
        session.handlersCount[handlerName] += 1;
        const sessionKey = this.getChatCompletionSessionKey(sessionId, systemMessageName);
        await this.client.set(sessionKey, JSON.stringify(session), 'EX', this.sessionTtl);
    }
    async save(session) {
        l.info(`Save session: ${session.sessionId}, systemMessageName: ${session.systemMessageName}`);
        const existingSession = await this.getSession(session.sessionId, session.systemMessageName);
        // fix redis frequency save by the same key issue
        if (deepEqual(existingSession, session)) {
            l.warn(`sessionId ${session.sessionId}, systemMessageName: ${session.systemMessageName} - session not changed, skip save and return existing session`);
            return existingSession;
        }
        existingSession.messages.length = 0;
        session.messages.forEach((message) => {
            existingSession.messages.push(message);
            existingSession.lastMessageByRole[message.author] = message;
        });
        existingSession.ctx = session.ctx;
        existingSession.updatedAt = getTimestamp();
        existingSession.messageAccumulator = session.messageAccumulator;
        existingSession.lastError = session.lastError;
        const sessionKey = this.getChatCompletionSessionKey(session.sessionId, session.systemMessageName);
        await this.client.set(sessionKey, JSON.stringify(existingSession), 'EX', this.sessionTtl);
        return this.getSession(session.sessionId, session.systemMessageName);
    }
    async getSession(sessionId, systemMessageName) {
        try {
            l.info(`Get session: ${sessionId}, systemMessageName: ${systemMessageName}`);
            const sessionKey = this.getChatCompletionSessionKey(sessionId, systemMessageName);
            const sessionData = await this.client.get(sessionKey);
            if (!sessionData) {
                throw new Error(`Session ${sessionId} not found`);
            }
            const SessionData = JSON.parse(sessionData);
            const session = new Session(this, SessionData);
            return session;
        }
        catch (error) {
            l.error(error);
            throw error;
        }
    }
}

const MiddlewareStatuses = { ...MiddlewareStatus };

export { ChatCompletion, ChatHistory, CloudStorageService, Message, MiddlewareStatuses, PromptService, PromptStorage, S3Service, Session, SessionStorage, SystemMessageService, SystemMessageStorage, getContentOfChoiceByIndex, modifyContentOfChoiceByIndex };
