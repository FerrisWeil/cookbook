## F1 MCP

F1.1 A caller with the shared secret can read a recipe.
- F1.1.1 A deleted recipe is not read. [Proposed]
- F1.1.2 The read includes nutrition when the recipe has it. [Proposed]
- F1.1.3 The read includes the title. [Proposed]
- F1.1.4 The read includes the steps in saved order. [Proposed]
- F1.1.5 The read includes the servings. [Proposed]

F1.2 A caller with the shared secret can list recipes.
- F1.2.1 A deleted recipe is not listed. [Proposed]
- F1.2.2 The list is not a search. [Proposed]

F1.3 A caller with the shared secret can save a recipe.
- F1.3.1 A save may include the one nutrition row. [Proposed]
- F1.3.2 A save names an actor. [Proposed]
- F1.3.3 There is no default actor. [Proposed]
- F1.3.4 A save includes a non-empty title. [Proposed]
- F1.3.5 A save includes the steps in order. [Proposed]
- F1.3.6 A save includes the servings. [Proposed]
- F1.3.7 A save may include the favorite and the rating. [Proposed]

F1.4 MCP calls require the shared secret.
- F1.4.1 A call without the shared secret is rejected. [Proposed]
- F1.4.2 Liveness does not require the secret. [Proposed]
- F1.4.3 The liveness response is status only. [Proposed]

F1.5 v1 limits the MCP recipe operations.
- F1.5.1 The recipe operations are read, list, and save. [Proposed]
- F1.5.2 v1 has no journal tool. [Proposed]
- F1.5.3 v1 has no tag tool. [Proposed]
- F1.5.4 v1 has no search tool. [Proposed]
