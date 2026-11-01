## S1 Deployment

S1.1 Production is one Compose stack on the household Unraid NAS.
- S1.1.1 The NAS runs images built elsewhere. [Proposed]
- S1.1.2 The NAS does not compile the app. [Proposed]
- S1.1.3 Production publishes no host ports. [Proposed]
- S1.1.4 Production has no default secret. [Proposed]

S1.2 The household reaches the app only over the tailnet.
- S1.2.1 The app and the MCP server are separate tailnet identities. [Proposed]
- S1.2.2 Family devices can open the app. [Proposed]
- S1.2.3 The bot can open the MCP server only. [Proposed]
- S1.2.4 There is no public ingress. [Proposed]
- S1.2.5 Funnel is off. [Proposed]
- S1.2.6 A local stack may publish ports. [Proposed]
- S1.2.7 That local path is not how the household reaches production. [Proposed]
- S1.2.8 Tailnet HTTPS is off. [Proposed]
- S1.2.9 The production tailnet address does not have to offer install. [Proposed]

S1.3 The database is backed up while it is running.
- S1.3.1 Backups are logical dumps of the running database. [Proposed]
- S1.3.2 A dump includes a deleted recipe. [Proposed]

S1.4 An update waits for a current dump.
- S1.4.1 An update does not start until a dump of the current database has been taken. [Proposed]
- S1.4.2 Nothing pulls new images on its own. [Proposed]

S1.5 v1 is one household stack.
- S1.5.1 v1 is the web app, the API, Postgres, and one cookbook MCP. [Proposed]
- S1.5.2 Chef is outside this repo. [Proposed]

S1.6 The API stays inside the stack.
- S1.6.1 Only the web app and the MCP server can call the API. [Proposed]
- S1.6.2 The API is not a tailnet identity. [Proposed]
