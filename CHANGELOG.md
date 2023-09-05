1. [x] ability to resend message to LLM from LLM IO Middlewares and EventHandlers. And add methods for make LLM API calls with rate limit.
3. [x] External dependency injection
4. [x] write docs
5. [x] create example project
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
22. [x] add createdAt to each message to input, but optional
23. [x] add incoming messages accumulator to session
24. [x] add ability to send batch of messages and system messages to LLM
25. [x] add global error handler - all errors need send to registered global ErrorHandler
26. [x] add logger to LLM Orchestrator
27. [x] accumulator flow control
28. [ ] Create Custom Error Classes
29. [ ] add event if LLM response delayed

