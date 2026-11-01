# 0017. One UI package

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-26

## Problem

Shared controls get copied into each screen. Naming a component library in the product decision makes a later swap another product decision.

## Options considered

1. **Lock a component library as the product decision** — a specific kit is then hard to leave.
2. **Ban third-party UI libraries** — a small supply chain, and a well-tested library is off limits.
3. **One shared package** — screens import it. A library inside the package is not a product decision.

## Decision

One shared UI package. Screens import it. A component library inside it is not a product decision.

## Consequences

* The API and MCP do not import it.
* The package is not in the tree yet. The name and path are in the design-system doc when it lands.
* Token values stay the bar in [0016](0016-kitchen-ui.md). The measured values are in the tokens doc.
* Swapping the library later edits the package. It does not need a new ADR.
