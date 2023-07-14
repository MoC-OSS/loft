# Getting Started Guide
## Introduction
This documentation provides a step-by-step guide on setting up and using the LLM-orchestrator framework in a backend project with the Fastify framework.

## Initial Setup
1. Start by installing the LLM-orchestrator library from the GitHub repository using npm.

    ```bash
    npm i git+ssh://git@github.com:MoC-Conversational/LLM-orchestrator.git
    ```

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
    } from "llm-orchestrator";
    import { cfg } from "./config/env";

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
      cfg.APP_NAME
    );

    const sms = new SystemMessageService(systemMessageStorage, s3);

    const historyClient = new Redis({
      host: cfg.REDIS_HOST,
      port: cfg.REDIS_PORT,
      db: cfg.HISTORY_DB,
    });
    const hs = new HistoryStorage(historyClient, 24 * 60 * 60);

    llm = await LlmOrchestrator.createInstance(
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
      } as Config,
      sms,
      hs
    );
    ```

## Requirements
The LLM Orchestrator requires several resources, such as Redis, OpenAI, and S3, to function properly.

## Setting Up Endpoints

1. Establish a `chatCompletion` endpoint for your backend. This endpoint will take a `request.body` as input and pass it to the created LLM Orchestrator instance.


    ```js
    server.post<ChatCompletionHandler>(
      "/chat-completion",
      { schema: { ...chatCompletionSchema } },
      async (request, reply) => {
        try {
          llm.chatCompletion(request.body);
        } catch (e) {
          console.error(e);
          reply.status(500).send({ error: e });
        }
      }
    );
    ```

2. Upload a prepared system_messages.json file with SystemMessages and ModelPresets to your S3 bucket, following this path: bucket-name/bot-name-from-env/env/system_messages.json. 

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

1. Register ComputeSystemMessage() callback for each SystemMessage from the system_messages.json file that needs rendering.

    ```js
    llm.useComputeSystemChatMessage(
          "echo message as json", // system message name must be the same as in system_messages.json file
          async (input: SystemMessageType): Promise<SystemMessageType> => {
            // modify input here
            return input;
          }
        );
    ```

2. Register LLM input and output middlewares. These middlewares can filter Personally Identifiable Information (PII) at LLM input, process output messages, or modify them.

    ```js
    llm.useLLMInput(
          "handle user input", // name used for logging
          async (
            input: string,
            next: (input: string) => Promise<void>
          ): Promise<void> => {
            // filter or modify input here
            const edited = `modified INPUT by middleware: ${input}`;
            await next(edited); // you must call next() callback to pass control to the next middleware.
          }
        );
        llm.useLLMOutput(
          "handle llm output", // name used for logging
          async (
            input: string,
            next: (response: string) => Promise<void>
          ): Promise<void> => {
            // filter or modify response here
            const edited = `modified OUTPUT by middleware: ${input}`;
            await next(edited); // you must call next() callback to pass control to the next middleware.
          }
        );
    ```

3. Register the EventHandler() callback for handling expected events based on LLM responses.
  An example for this could be a JSON object with the property { "eventType": "eventName" } or any properties with known names and types. Validation can be achieved using a zod schema.
  The presence or coincidence of fields in a JSON object can be considered an event.
  Please consider adapting and using examples from [LangChain OutputParsers](https://js.langchain.com/docs/modules/prompts/output_parsers/) instead of the primitive example provided below:

    ```js
    llm.useEventHandler("echo handler", {
      eventDetector: async ( // event detector must return boolean value
        response: string,
        next: () => Promise<void>
      ): Promise<boolean> => {
        return repronse === "some event" || //try to detect event
        response.includes("{"eventType":");
      },
      handler: async (response: string, next: () => Promise<void>) => {
        // handle event here
        // you can use next() callback to pass control to the next event handler to handle several events and then LLM Orchestrator will execute Handler with the highest priority
        // if you don't use next() callback, and eventDetector will return true, then LLM Orchestrator will execute Handler immediately
        console.log("RESPONSE", response);
      },
      priority: 0, // priority of event handler from 0 to infinity. The higher number has higher priority
    } as EventHandler);
    ```
4. Register the DefaultHandler() callback for handling unexpected events or responses based on LLM responses.

    ```js
    llm.useDefaultHandler(async (llmResponse: string) => {
      // handle unexpected response here
      console.log("DEFAULT HANDLER RESPONSE: ", llmResponse);
    });
    ```

## Soon To Be:
1. [x] ability to resend message to LLM from LLM IO Middlewares and EventHandlers. And add methods for make LLM API calls with rate limit.
2. [ ] Using parts of libraries from LangChainJS
3. [x] External dependency injection
4. [x] write docs
5. [x] create example project
6. [ ] connect Langchain history
7. [x] separate chats by combined sessionId, systemMessageId
8. [x] add user context to middlewares, handlers, etc...
9. [x] add method to create injections using systemMessageName
10. [x] add method for clear session
11. [x] add ability to write data to session context
12. [x] add last role message to session
13. [x] add .update method to session.ctx.update()
14. [x] add job time to config
15. [x] refactor HistoryStorage to Entity Based way Session class
16. [x] provide retries control to bullmq
18. [x] detect source of handled caller and return this sourceName to handler and middlewares
19. [x] counter for each registered handler and return this counter to handler
20. [x] create overloop prevention and provide control when registered handler
21. [x] add support OpenAI functions
22. [ ] add createdAt to each message to input, but optional
23. [ ] add mechanism to insert messages to own slots in history
24. [ ] add incoming messages accumulator to session
25. [ ] add ability to send batch of messages and system messages to LLM
