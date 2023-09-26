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

1. Start by installing the LOFT library from npm.

   ```bash
   npm install @mocg/loft-openai
   ```

   OR for development purposes, clone the repository and link it to your project.

   ```bash
   cd projects_folder
   git clone https://github.com/MoC-OSS/loft.git
   cd loft
   git checkout openai/main
   git pull origin openai/main
   npm i
   npm build
   npm link
   cd projects_folder/your_project
   npm i
   npm link @mocg/loft-openai && npm run start
   ```

   Recommended to use npm link before each npm run start to ensure the latest changes are applied, and the library is linked to the project.

2. Next, create an instance of the LLM-Orchestrator, passing the `Config` object to the `LlmOrchestrator.createInstance()` method.

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
   } from '@mocg/loft-openai';
   import Redis from 'ioredis';

   import { cfg } from './config/env';

   const systemMessageClient = new Redis({
     host: cfg.REDIS_HOST,
     port: cfg.REDIS_PORT,
     db: cfg.SYSTEM_MESSAGE_DB,
   });
   const systemMessageStorage = new SystemMessageStorage(systemMessageClient);

   const s3 = new S3Service(
     cfg.NODE_ENV,
     cfg.S3_REGION,
     cfg.S3_BUCKET_NAME,
     cfg.APP_NAME,
   );

   const sms = new SystemMessageService(systemMessageStorage, s3);

   const historyClient = new Redis({
     host: cfg.REDIS_HOST,
     port: cfg.REDIS_PORT,
     db: cfg.HISTORY_DB,
   });
   const hs = new SessionStorage(historyClient, 24 * 60 * 60, cfg.APP_NAME);

   function chatCompletionErrHandler(
     error: Error | unknown,
     llmResponse: ErrorProperties,
   ) {
     console.log('ERROR HANDLER: ', error);
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
     chatCompletionErrHandler,
   );
   ```

## Requirements

The Loft requires several resources, such as Redis, OpenAI, and S3, to function properly.

## Setting Up Endpoints

3. Establish a `chatCompletion` endpoint for your backend. This endpoint will take a `request.body` as input and pass it to the created LLM Orchestrator instance.

   ```js
   // chatCompletionSchema: {
   //  systemMessageName: string;
   //  message: string;
   //  sessionId: string
   //  intent: string
   //}
   server.post <
     ChatCompletionHandler >
     ('/chat-completion',
     { schema: { ...chatCompletionSchema } },
     async (request, reply) => {
       try {
         chat.call(request.body);
       } catch (e) {
         console.error(e);
         reply.status(500).send({ error: e });
       }
     });
   ```

4. Upload a prepared system_messages.json file with SystemMessages and ModelPresets to your S3 bucket, following this path: bucket-name/bot-name-from-env/env/system_messages.json.

   The LLM Orchestrator will sync this file with Redis upon library initialization.

   You can also manually sync SystemMessages with the llm.syncSystemMessages() method.

   ```js
   server.post('/sync-sys-msgs', async (request, reply) => {
     try {
       await llm.syncSystemChatMessages();
       reply.send({ status: 'ok' });
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
  'echo message as json', // system message name must be the same as in system_messages.json file
  async (input: SystemMessageType): Promise<SystemMessageType> => {
    // modify input here
    return input;
  },
);
```

Optional: Register ComputePrompt() callback to compute personalized prompts for each user.

```js
chat.useComputePrompt(
  'name',
  async (input: PromptType, ctx: SessionProps): Promise<PromptType> => {
    console.log('USER INPUT: ', input);

    return input;
  },
);
```

6. Optional: Register LLM input and output middlewares. These middlewares can filter Personally Identifiable Information (PII) at LLM input, process output messages, or modify them.

   ```js
   // ? Is Optional. use it if you want to filter or modify user input messages
   chat.useLLMInput(
     'handle LLM input',
     async (
       input,
       next: (input: ChatInputPayload) => Promise<void>,
     ): Promise<void> => {
       // filter or modify input here
       // const edited = `modified input by middleware: ${input}`;
       console.log('INPUT: ', input);

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
     },
   );

   // ? Is Optional. use it if you want to filter or modify MML output/response
   chat.useLLMOutput(
     'handle LLM output',
     async (
       ctx: OutputContext,
       next: (output: OutputContext) => Promise<void>,
     ): Promise<{
       status?: MiddlewareStatus,
       newOutputContext: OutputContext | undefined,
     }> => {
       // filter or modify response here
       console.log('OUTPUT MIDDLEWARES: ', ctx);

       console.log('SESSION_CTX:', ctx.session.ctx);
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
     },
   );
   ```

7. Register the EventHandler() callback for handling expected events based on LLM responses.
   An example for this could be a JSON object with the property { "eventType": "eventName" } or any properties with known names and types. Validation can be achieved using a zod schema.
   The presence or coincidence of fields in a JSON object can be considered an event.
   Please consider adapting and using examples from [LangChain OutputParsers](https://js.langchain.com/docs/modules/prompts/output_parsers/) instead of the primitive example provided below:

   ```js
   chat.useEventHandler('nameThatDescribeExpectedEvent', {
     // event detector must return boolean value.
     // Optionally: you can use next() callback to pass control to the next event detector to detect several events and then LLM Orchestrator will execute Handler with the highest event priority
     eventDetector: async (
       ctx: OutputContext,
       next: () => Promise<void>,
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
         role: { $eq: 'user' },
         isArchived: { $eq: false },
       });

       const mostRelevantMessageOfChoices = getContentOfChoiceByIndex(ctx, 0); // you can use helper to get the most relevant OpenAi response

       // archive the message if you don't want to exclude it before send it to the LLM API, but not delete it from the messages: ChatHistory
       ctx.session.messages.archiveById(userMessage[0].id);

       console.log('RESPONSE: ', mostRelevantMessageOfChoices);

       const lastUserMessage = ctx.session.lastMessageByRole.user;
       if (!lastUserMessage)
         throw new Error(
           'lastUserMessage is undefined. Please check the chat history. And handle this case.',
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
     console.log('DEFAULT HANDLER RESPONSE: ', llmResponse);
   });
   ```

## Conceptions

### - SystemMessageComputers

**SystemMessageComputers** - is a callback function that can modify SystemMessage before send it to the LLM API.

- can modify the SystemMessage
- can call third party services or DB queries

### - PromptComputers - is a callback function that can modify Prompt before send it to the LLM API for injection.

- can modify the SystemMessage
- can call third party services or DB queries

### - Input Middlewares

**Input Middlewares** - is a chain of functions that can modify the user input before save it in history and sending it to the LLM API.

- can modify the user input
- don't have session or access to the chat history
- can call third party services or DB queries
- - can control the chain of output middlewares by calling next() callback

### - Output Middlewares

**Output Middlewares** - is a chain of functions that can modify the LLM response before save it in history and sending it to the Event Handlers.

- can modify the LLM response
- can access to the chat history
- can set the custom session context
- can use the session.messages.query() method to query the chat history
- can use the session.messages.methods to modify the chat history
- can call third party services or DB queries
- can callRetry LLM to restart the chat completion job with the modified chat history
- can control the chain of output middlewares by calling next() callback

### - Functions

**Functions** - is a OpenAi feature that can be used to provide needed context information to the LLM API before LLM model will generate the response.

- can be called by LLM Model before generate the response
- can use third party services or DB queries
- must return string value

### - Event Handlers || Default Handler

**Event Handlers** - is a chain of event detectors and registered handlers that can be used to handle the LLM response based on the chat history.

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

### ErrorHandler

**ErrorHandler** - is a callback function that can be used to handle the error from the Chat Completion lifecycle and inner dependencies.

- can access and manage to the chat history if received session object.
- can call retry() method to restart the chat completion lifecycle.
- can control/realize Message Accumulator to the chat history and continue the chat completion lifecycle - try to use it only if you can't handle the error, and you need try to continue the chat completion lifecycle.
- can call third party services or DB queries.
- can respond to the bot provider webhook or directly to user.
- can notificate the developers about the error.

### Full code example by url: https://github.com/MoC-Conversational/Backend-Example/blob/dev/src/index.ts

## Soon To Be:

1. [x] ability to resend message to LLM from LLM IO Middlewares and EventHandlers. And add methods for make LLM API calls with rate limit.
2. [x] External dependency injection
3. [x] write docs
4. [x] create example project
5. [x] separate chats by combined sessionId, systemMessageId
6. [x] add user context to middlewares, handlers, etc...
7. [x] add method to create injections using systemMessageName
8. [x] add method for clear session
9. [x] add ability to write data to session context
10. [x] add last role message to session
11. [x] add .update method to session.ctx.update()
12. [x] add job time to config
13. [x] refactor HistoryStorage to Entity Based way Session class
14. [x] provide retries control to bullmq
15. [x] detect source of handled caller and return this sourceName to handler and middlewares
16. [x] counter for each registered handler and return this counter to handler
17. [x] create overloop prevention and provide control when registered handler
18. [x] add support OpenAI functions
19. [x] add createdAt to each message to input, but optional
20. [x] add incoming messages accumulator to session
21. [x] add ability to send batch of messages and system messages to LLM
22. [ ] add event if LLM response delayed
23. [x] add global error handler - all errors need send to registered global ErrorHandler
24. [x] add logger to LLM Orchestrator
25. [ ] Create Custom Error Classes
26. [x] accumulator flow control
27. [x] user input flow controller
