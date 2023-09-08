## Introduction

LLM-Orchestrator (LOFT) is a robust framework designed for high-throughput, scalable backend systems. It provides comprehensive features for handling chat completion, chat input/output middlewares, event detection, handling, and more. LOFT is independent of any HTTP framework. Built on a queue-based architecture, LOFT supports rate-limiting and horizontal scaling, making it ideal for large-scale deployments.

## Key Features

- **Framework Agnostic**: Seamlessly integrates into any backend system without dependencies on HTTP frameworks.
- **Queue-Based Architecture**: Optimized for high-throughput scenarios.
- **Dynamically Computed Prompts**: Supports dynamically generated prompts for personalized user interactions.
- **Chat Input/Output Middlewares**: Extensible middlewares for chat input and output.
- **Event Detection and Handling**: Advanced capabilities for detecting and handling chat-based events.
- **Rate-Limiting and Horizontal Scaling**: Built-in rate-limiting capabilities that work seamlessly in horizontally scaled environments.

## Initial Setup

1. Start by installing the LOFT library from the GitHub repository using npm.

```bash
npm install @mocg/loft-palm
```

OR for development purposes, clone the repository and link it to your project.

```bash
cd projects_folder
git clone git@github.com:MoC-OSS/loft.git
cd loft
git checkout palm/main
npm i
npm link
cd projects_folder/your_project
npm i
npm link @mocg/loft-palm && npm run start:dev
```

Recommended to use npm link before each npm run start:dev to ensure the latest changes are applied, and the library is linked to the project.

1. Next, create an instance of the LOFT, passing the `Config` object to the `LlmOrchestrator.createInstance()` method.

```js
import {
  LlmOrchestrator,
  Config,
  SystemMessageType,
  EventHandler,
  SystemMessageStorage,
  SystemMessageService,
  HistoryStorage,
  S3Service,
} from "@mocg/loft-palm";
import { cfg } from "./config/env";

const systemMessageClient = new Redis({
  host: cfg.REDIS_HOST,
  port: cfg.REDIS_PORT,
  db: cfg.SYSTEM_MESSAGE_DB,
});
const systemMessageStorage = new SystemMessageStorage(systemMessageClient);

const cloudStorage = new CloudStorageService(
      cfg.NODE_ENV,
      cfg.GCP_CLOUD_STORAGE_BUCKET_NAME,
      cfg.APP_NAME
    );

const sms = new SystemMessageService(systemMessageStorage, cloudStorage);
const ps = new PromptService(promptStorage, cloudStorage);


const historyClient = new Redis({
  host: cfg.REDIS_HOST,
  port: cfg.REDIS_PORT,
  db: cfg.HISTORY_DB,
});
const hs = new HistoryStorage(historyClient, 24 * 60 * 60);

async function chatCompletionErrHandler(
  error: Error | unknown,
  llmResponse: ErrorProperties
) {
  console.log("ERROR HANDLER: ", error);
}

const chat = await LlmOrchestrator.createInstance(
  {
    nodeEnv: cfg.NODE_ENV,
    appName: cfg.APP_NAME,
    redisHost: cfg.REDIS_HOST,
    redisPort: cfg.REDIS_PORT,
    bullMqDb: cfg.BULLMQ_DB,
    openAiKey: cfg.OPENAI_API_KEY,
    openAiRateLimiter: {
      max: cfg.OPENAI_MAX_REQ_BY_DURATION,
      duration: cfg.OPENAI_DURATION,
      concurrency: cfg.OPENAI_CONCURRENCY,
    },
    jobsLockDuration: cfg.JOBS_LOCK_DURATION,
    jobsAttempts: cfg.JOBS_ATTEMPTS,
    chatCompletionJobCallAttempts: cfg.CHAT_COMPLETION_JOB_CALL_ATTEMPTS,
  },
  sms,
  ps,
  hs,
  chatCompletionErrHandler
);
```

## Requirements

The LLM Orchestrator requires several resources, such as Redis, OpenAI, and S3, to function properly.

## Setting Up Endpoints

3. Establish a `chatCompletion` endpoint for your backend. This endpoint will take a `request.body` as input and pass it to the created LLM Orchestrator instance.

```js
server.post<ChatCompletionHandler>(
  "/chat-completion",
  { schema: { ...chatCompletionSchema } },
  async (request, reply) => {
    try {
      chat.call(request.body);
    } catch (e) {
      console.error(e);
      reply.status(500).send({ error: e });
    }
  }
);
```

4. Upload a prepared system_messages.json file with SystemMessages and ModelPresets to your S3 bucket, following this path: bucket-name/bot-name-from-env/env/system_messages.json.

The LLM Orchestrator will sync this file with Redis upon library initialization.
You can also manually sync SystemMessages with the llm.syncSystemMessages() method.

```js
server.post("/sync-sys-msgs", async (request, reply) => {
  try {
    await llm.syncSystemChatMessages();
    reply.send({ status: "ok" });
  } catch (e) {
    console.error(e);
    reply.status(500).send({ error: e });
  }
});
```

## Register Callbacks

5. Optional: Register ComputeSystemMessage() callback for each SystemMessage from the system_messages.json file that needs rendering.

```js
llm.useComputeSystemMessage(
  "echo message as json", // system message name must be the same as in system_messages.json file
  async (input: SystemMessageType): Promise<SystemMessageType> => {
    // modify input here
    return input;
  }
);
```

Optional: Register ComputePrompt() callback to compute personalized prompts for each user.

```js
chat.useComputePrompt(
  "name",
  async (input: PromptType, ctx: SessionProps): Promise<PromptType> => {
    console.log("USER INPUT: ", input);

    return input;
  }
);
```

6. Optional: Register LLM input and output middlewares. These middlewares can filter Personally Identifiable Information (PII) at LLM input, process output messages, or modify them.

```js
// ? Is Optional. use it if you want to filter or modify user input messages
chat.useLLMInput(
  "handle LLM input",
  async (
    input,
    next: (input: ChatInputPayload) => Promise<void>
  ): Promise<void> => {
    // filter or modify input here
    // const edited = `modified input by middleware: ${input}`;
    console.log("INPUT: ", input);
    // input.messages usually contains only one message in array, but if the user sends messages faster than the bot can respond, the messages will be batched
    const modifiedMessages = input.messages.map((m) => {
      // modify message here
      return m;
    });
    const newContext: ChatInputPayload = {
      ...input,
      messages: modifiedMessages,
    };
    // you should always call next() to pass the modified input to the next middleware
    // if you don't call next(), other middlewares will not be called
    // pass the modified input to the next middleware
    await next(newContext);
  }
);

// ? Is Optional. use it if you want to filter or modify MML output/response
chat.useLLMOutput(
  "handle LLM output",
  async (
    ctx: OutputContext,
    next: (output: OutputContext) => Promise<void>
  ): Promise<{
    status?: MiddlewareStatus;
    newOutputContext: OutputContext | undefined;
  }> => {
    // filter or modify response here
    console.log("OUTPUT MIDDLEWARES: ", ctx);
    console.log("SESSION_CTX:", ctx.session.ctx);
    ctx.session.ctx = { ...ctx.session.ctx, userActionFlag: true }; // set custom flag in session context
    //! please don't save session context at output middlewares, like await ctx.session.save(); it will be saved automatically after the middlewareChain finishes successfully.
    //! It's very important, otherwise you can lose last session context data. Because it Redis limitation when we try to write data in parallel to the same key.

    const mostRelevantChoice = getContentOfChoiceByIndex(ctx, 0); // get the most relevant OpenAi choice
    const modifiedContent = `modified output by middleware: ${mostRelevantChoice}`;
    modifyContentOfChoiceByIndex(ctx, 0, modifiedContent);

    // Also you can query the chat history using ChatHistory method ctx.session.messages.query(mongoLikeQueryByMesaageProps)
    // And if you feel that the response is not relevant, or not satisfy your requirements,
    // you can change the ctx.session.messages using ChatHistory methods like append(), updateById(), archiveById(), deleteById(), appendAfterMessageId(), replaceById(), replaceAll().
    // And then you should call ctx.session.save() to save the changes to the Redis.
    // And "return chat.callRetry()"
    // it will break/stop the OutputMiddlewareChain and event handlers, and will start the chat completion job again with the modified ctx.session.messages.

    await next(ctx);

    /* you can control the middleware chain by returning MiddlewareStatus.CONTINUE || undefined to continue the middleware chain
        OR you can return MiddlewareStatus.CALL_AGAIN || STOP to interrupt the middleware chain and event handlers */
    return {
      newOutputContext: ctx,
      status: MiddlewareStatuses.CONTINUE,
    };
  }
);
```

7. Register the EventHandler() callback for handling expected events based on LLM responses.
  An example for this could be a JSON object with the property { "eventType": "eventName" } or any properties with known names and types. Validation can be achieved using a zod schema.
  The presence or coincidence of fields in a JSON object can be considered an event.
  Please consider adapting and using examples from [LangChain OutputParsers](https://js.langchain.com/docs/modules/prompts/output_parsers/) instead of the primitive example provided below:

```js
chat.useEventHandler("nameThatDescribeExpectedEvent", {
  // event detector must return boolean value.
  // Optionally: you can use next() callback to pass control to the next event detector to detect several events and then LLM Orchestrator will execute Handler with the highest event priority
  eventDetector: async (
    ctx: OutputContext,
    next: () => Promise<void>
  ): Promise<boolean> => {
    // you can use ctx.session.messages.query() to query the chat history and detect the event based on the data in the chat history
    // or try to parse json from LLM response
    return true; // return true if the event is detected and you want to execute the handler, otherwise return false
  },
  // Into handler you can use the same session methods as in OutputMiddlewareChain to modify the ctx.session.messages and ctx.session.ctx and then call "await ctx.session.save()".
  // Please use "await ctx.session.save()" only once in the handler, otherwise you can lose last session context data. Because it Redis limitation when we try to write data in parallel to the same key.
  handler: async (ctx: OutputContext, next: () => Promise<void>) => {
    // example of using query() method to get the interesting message from the chat history
    const userMessage = ctx.session.messages.query({
      role: { $eq: "user" },
      isArchived: { $eq: false },
    });

    const mostRelevantMessageOfChoices = getContentOfChoiceByIndex(ctx, 0); // you can use helper to get the most relevant OpenAi response

    // archive the message if you don't want to exclude it before send it to the LLM API, but not delete it from the messages: ChatHistory
    ctx.session.messages.archiveById(userMessage[0].id);

    console.log("RESPONSE: ", mostRelevantMessageOfChoices);

    const lastUserMessage = ctx.session.lastMessageByRole.user;
    if (!lastUserMessage)
      throw new Error(
        "lastUserMessage is undefined. Please check the chat history. And handle this case."
      );
    // sometimes before send user input to LLM API you need to send some instructions for LLM API, new product information or another context relevant "embedding" information from vector DB.
    // You can use injectPromptAndSend() method to send the prompt before user input. Prompt stored in S3 bucket, cached with Redis and can be computed to achieve better personalization.
    // ! instead injections you can use new OpenAi approach: Functions, to send the prompt before user input. chat.useFunction("name", async (ctx, args) => { return "prompt" }) and add function manifest to S3 file into SystemMessage.modelPreset.functions[]
    // await chat.injectPromptAndSend(
    //   "name", // you can register useComputePrompt callback with this name and it will be called before send the prompt to the LLM API. you can use it to compute the prompt based on the user context.
    //   ctx.session,
    //   [lastUserMessage] // "this user message that will sent after the prompt"
    // );

    ctx.session.ctx = { ...ctx.session.ctx, userActionFlag: false };
    await ctx.session.save();

    // also you can use chat.callRetry() to break the event handler chain and start the chat completion job again with the modified ctx.session.messages.
    // also you can access to your DB or third party services into event handler.

    // finally in this place you can send response to the bot provider webhook or directly to user
  },
  // Priority of the event handler.
  // If several event handlers detect the event, then LLM Orchestrator will execute the handler with the highest priority.
  // Biggest number is higher priority.
  priority: 0,
  // Max loops to execute callRetry() method for this handler.
  maxLoops: 10,
});
```

8. Register the DefaultHandler() callback for handling unexpected events or responses based on LLM responses.

```js
llm.useDefaultHandler(async (llmResponse: string) => {
  // handle unexpected response here
  console.log("DEFAULT HANDLER RESPONSE: ", llmResponse);
});
```

## Conceptions

**SystemMessageComputers** - is a callback function that can modify SystemMessage before send it to the LLM API.

- can modify the SystemMessage
- can call third party services or DB queries

**PromptComputers** - is a callback function that can modify Prompt before send it to the LLM API for injection.

- can modify the SystemMessage
- can call third party services or DB queries

**Input Middlewares** - is a chain of functions that can modify the user input before save it in history and sending it to the LLM API.

- can modify the user input
- don't have session or access to the chat history
- can call third party services or DB queries
- can control the chain of output middlewares by calling next() callback
  
**Output Middlewares** - is a chain of functions that can modify the LLM response before save it in history and sending it to the Event Handlers.

- can modify the LLM response
- can access to the chat history
- can set the custom session context
- can use the session.messages.query() method to query the chat history
- can use the session.messages.methods to modify the chat history
- can call third party services or DB queries
- can callRetry LLM to restart the chat completion job with the modified chat history
- can control the chain of output middlewares by calling next() callback

**Event Handlers  || Default Handler** - is a chain of event detectors and registered handlers that can be used to handle the LLM response based on the chat history.

- can access to the chat history
- can set the custom session context
- can use the session.messages.query() method to query the chat history
- can use the session.messages.methods to modify the chat history
- can call third party services or DB queries
- can callRetry() LLM to restart the chat completion job with the modified chat history
- can control the chain of event detectors by calling next() callback
- can prioritize the event handlers by priority property
- can control the max loops of callRetry() method by maxLoops property
- it's finally step of the chat completion lifecycle, on this step you can send response to the bot provider webhook or directly to user

**ErrorHandler** - is a callback function that can be used to handle the error from the Chat Completion lifecycle and inner dependencies.

- can access and manage to the chat history if received session object.
- can call retry() method to restart the chat completion lifecycle.
- can control/realize Message Accumulator to the chat history and continue the chat completion lifecycle - try to use it only if you can't handle the error, and you need try to continue the chat completion lifecycle.
- can call third party services or DB queries.
- can respond to the bot provider webhook or directly to user.
- can notificate the developers about the error.
