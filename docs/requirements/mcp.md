# MCP

Category F1. Status: Proposed.

Drawn from the accepted decisions. Taylor answered the open questions in chat. Each statement stays Proposed until he accepts it.

Retired, not reused: F1.1.1, F1.2, F1.2.1, F1.2.2, F1.2.3, F1.3, F1.3.1, F1.3.2, F1.3.3, F1.3.4.

## F1.1 Read

Status: Proposed.

A caller with the shared secret can read a recipe that is not deleted, including its nutrition when it has one.

### F1.1.2 Title, steps, servings

Status: Proposed.

A read includes the title, the steps in saved order, and the servings.

## F1.6 List

Status: Proposed.

A caller with the shared secret can list recipes that are not deleted.

### F1.6.1 Not search

Status: Proposed.

The list is not a search.

## F1.7 Save

Status: Proposed.

A caller with the shared secret can save a recipe.

### F1.7.1 Nutrition row

Status: Proposed.

A save may include the one nutrition row.

### F1.7.2 Actor

Status: Proposed.

A save names an actor. There is no default actor.

### F1.7.3 Title, steps, servings

Status: Proposed.

A save includes a non-empty title, the steps in order, and the servings.

### F1.7.4 Favorite and rating

Status: Proposed.

A save may include the favorite and the rating.

## F1.4 Secret

Status: Proposed.

A call without the shared secret is rejected.

### F1.4.1 Liveness

Status: Proposed.

Liveness does not require the secret. The response is status only.

## F1.5 Scope

Status: Proposed.

The recipe operations are read, list, and save.

### F1.5.1 No other tools

Status: Proposed.

v1 has no journal tool, tag tool, or search tool.
