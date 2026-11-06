# Requirements migration (one-time)

Old per-topic YAML (`1-mcp.yaml` … `7-design-system.yaml`) used dotted ids and a `details` list. This file is the accounting for the move to [requirements.yaml](requirements.yaml). It is not a second catalog.

## ID scheme

Dotted ids encoded tree position (`1.1.1`). The new scheme is a stable positive integer plus a fingerprint of that node's id and text. Existing dotted ids cannot stay if ids must not mean position, so every old id is mapped below. Assignment walks old files in topic order, shared MCP auth first, parents before later siblings as the generator emitted them. Gaps are the parent ids assigned after their children.

Quoted strings are required in YAML. Identity is the decimal integer, not the spelling `"012"`.

## Counts

| Old | Count | Disposition |
| --- | ---: | --- |
| Topics + requirements + details | 191 | See rows below |
| Kept in the application catalog (new nodes, including shared root) | 154 | [requirements.yaml](requirements.yaml) |
| Leaves | 118 | 62 verified, 18 implemented, 38 accepted |
| Moved to [unraid-production.md](../unraid-production.md) | 3 topic + 5 req + 18 details, plus `2.2.5` and `5.6.3` | Hosting / operator |
| Moved to contributor process | `4.4`, `4.4.1`, `4.4.2` | [CONTRIBUTING.md](../../CONTRIBUTING.md), [security-review.md](../security-review.md) |
| Tooling tests, not product requirements | `6.6`, `6.6.1`–`6.6.4` | `pnpm check` / CI tests remain unbound |
| Collapsed single-child parents | `1.2`+`1.2.1`, `4.2`+`4.2.1`, `4.6`+`4.6.1`, `6.1`+`6.1.1` | Leaf keeps the detail text |
| Shared (not copied) | `1.4.1`/`6.4.1` → `1`; `1.4.2`/`6.3.2` → `2`; `1.4.3` → `3`; `1.4.4` → `4` | Shared root `5` |

`3.5.1` (only web and MCP call the API) stays in the catalog as portable auth (`82`). `3.5.2` (stack network) is hosting.

## Old id → new id

| Old | New | Notes |
| --- | --- | --- |
| 1 | 32 | MCP root |
| 1.1 | 13 | |
| 1.1.1–1.1.7 | 6–12 | |
| 1.2, 1.2.1 | 14 | collapsed |
| 1.3 | 26 | |
| 1.3.1–1.3.11 | 15–25 | |
| 1.4 | 27 | children are refs to 1–4 |
| 1.4.1, 6.4.1 | 1 | shared leaf |
| 1.4.2, 6.3.2 | 2 | shared leaf |
| 1.4.3 | 3 | shared leaf |
| 1.4.4 | 4 | shared leaf |
| 1.5 | 31 | |
| 1.5.1–1.5.3 | 28–30 | |
| 2 | 67 | Kitchen UI root |
| 2.1 | 35 | |
| 2.1.1–2.1.2 | 33–34 | accepted |
| 2.2 | 40 | |
| 2.2.1–2.2.4 | 36–39 | accepted |
| 2.2.5 | — | hosting; Unraid doc |
| 2.3 | 52 | |
| 2.3.1–2.3.11 | 41–51 | accepted |
| 2.4 | 58 | |
| 2.4.1–2.4.5 | 53–57 | accepted |
| 2.5 | 61 | |
| 2.5.1–2.5.2 | 59–60 | accepted |
| 2.6 | 66 | |
| 2.6.1–2.6.4 | 62–65 | accepted |
| 3, 3.1–3.5 except 3.5.1 | — | hosting; Unraid doc |
| 3.5.1 | 82 | portable API callers |
| 4 | 84 | Security root |
| 4.1 | 73 | |
| 4.1.1–4.1.5 | 68–72 | |
| 4.2, 4.2.1 | 74 | collapsed |
| 4.3 | 78 | |
| 4.3.1–4.3.3 | 75–77 | implemented; init-script tests |
| 4.4, 4.4.1, 4.4.2 | — | process |
| 4.5 | 81 | |
| 4.5.1–4.5.2 | 79–80 | |
| 4.6, 4.6.1 | 83 | collapsed; accepted, ambiguous vs caller tokens |
| 5 | 135 | Recipes root |
| 5.1 | 90 | |
| 5.1.1–5.1.5 | 85–89 | |
| 5.2 | 94 | |
| 5.2.1–5.2.3 | 91–93 | 92 implemented (household vs per-user weakly shown) |
| 5.3 | 98 | |
| 5.3.1–5.3.3 | 95–97 | |
| 5.4 | 109 | accepted because 101 is accepted |
| 5.4.1–5.4.10 | 99–108 | 101 estimated calculation accepted; 99,100,102,103,105 implemented |
| 5.5 | 115 | |
| 5.5.1–5.5.5 | 110–114 | memory store only |
| 5.6 | 118 | |
| 5.6.1–5.6.2 | 116–117 | |
| 5.6.3 | — | hosting; Unraid doc |
| 5.7 | 121 | |
| 5.7.1–5.7.2 | 119–120 | |
| 5.8 | 124 | |
| 5.8.1–5.8.2 | 122–123 | |
| 5.9 | 128 | accepted because 127 is accepted |
| 5.9.1–5.9.3 | 125–127 | 127 scaled view accepted; old test saved servings |
| 5.10 | 134 | |
| 5.10.1–5.10.5 | 129–133 | |
| 6 | 147 | Foundation root |
| 6.1, 6.1.1 | 136 | collapsed; compose file + smoke script, not a live `up` |
| 6.2 | 139 | |
| 6.2.1–6.2.2 | 137–138 | SSR, not a browser |
| 6.3 | 141 | ref to 2 |
| 6.3.1 | 140 | |
| 6.4 | 143 | ref to 1 |
| 6.4.2 | 142 | |
| 6.5 | 146 | |
| 6.5.1–6.5.2 | 144–145 | in-memory migrator, not Postgres |
| 6.6, 6.6.1–6.6.4 | — | tooling tests remain |
| 7 | 154 | Design system root |
| 7.1 | 150 | |
| 7.1.1–7.1.2 | 148–149 | accepted |
| 7.2 | 153 | |
| 7.2.1–7.2.2 | 151–152 | accepted |

## Coverage that is not verified

Do not treat old `covers()` mappings as verified. Assertions were read in this refactor:

- **101 / old 5.4.3** estimated nutrition: store accepts the label. No ingredient calculation. Status `accepted`. Unbound test only checks the label.
- **127 / old 5.9.3** scaled view: previous test called `save` with a new servings count (rewrote stored servings). No scaled view API. Status `accepted`.
- **99, 100, 105** nutrition row / per-serving / divisor: stored fields, not calculation. `implemented`.
- **92** household favorite: one boolean on the recipe, not a per-person model. `implemented`.
- **102, 103** entered/copied: label stored, provenance not proven. `implemented`.
- **136** compose stack: file and smoke-script assertions. `implemented`.
- **137, 138** home page: `renderToString`. `implemented`.
- **144, 145** migrations/seed: in-memory runner. `implemented`.
- **Postgres recipe store** (`apps/api/src/recipes/pg.ts`): no store tests. Recipe leaves are proven against the memory store.
- **82 / old 3.5.1**: both caller tokens work; exclusivity of those two callers is not proven. `implemented`.
- **83 / old 4.6.1**: recipe routes require caller tokens. Left `accepted`.
- **68** CI secret scan: gitleaks runs from `pnpm check`; no product binding (overlaps tooling). `implemented`.

## Other application tests (unbound)

These tests remain. This refactor does not invent catalog entries to absorb them.

| Test | Why unbound |
| --- | --- |
| `apps/mcp/test/host.test.ts` | Host/Origin allowlist. Not in the old catalog. Mix of portable DNS-rebinding protection and Tailscale/hostname policy. |
| API and MCP boot tests beyond bound leaves | Password encoding, identical URLs, caller-token pairing, bind/port. Overlap 4.1/4.5; extra cases stay tests. |
| `apps/api/test/recipe-http.test.ts` cases that duplicate memory-store leaves | One test per leaf is already bound in `recipes.test.ts`. |
| Health `/health/ready` 200/503 variants besides `140` | Extra status paths, not extra leaves. |
| `it("pins third-party image tags to digests")` | Supply-chain pin scan, not a catalog leaf. |
| `packages/shared/test/ready.test.ts` | Shared helper. |
| `packages/test` fingerprint, `verifies` runtime, and repo-check tests | Old `6.6` tooling. |
| MCP hello tool listing besides `142` | Extra listing assertion. |
| Migration failure does not record the id | Error-path around `144`, not a second leaf. |
| Estimated-label and scaled-servings tests | Explicit non-coverage for `101` and `127`. |

## Not imported

PR #38 (on #44, not master) added unimplemented kitchen details `2.7`–`2.9` (checked steps, wake lock, favorites filter). Not copied. Engineer can add them later as `accepted` leaves.

PR #40 was contributor-guidance stacked on #44. ADR-first wording is already retired on master (#47). Not reintroduced.

PR #44 gitleaks allowlist is already on master. Left open; not merged here.
