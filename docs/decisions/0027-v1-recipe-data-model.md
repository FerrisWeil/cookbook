# 0027. v1 recipe data model

* Status: proposed
* Date: 2026-10-27

> **Proposed ADRs are not decisions.** Do not mark `accepted` until Taylor confirms in this agent chat. Keep the pull request draft until then.

> **Merged means accepted** (Taylor, 2026-10-26). A pull request merged to `master` accepts the ADRs it contains. If this file merges while Status is still `proposed`, treat it as accepted as of the merge date and update this line. Do not merge it in that state unless Taylor has confirmed the decision. Do not rewrite a merged decision in place; supersede it with a new ADR.

## Problem

Chef needs to save a recipe and its notes, and Taylor needs to browse favorites and keep nutrition, on a model that can still change. [0004](0004-postgres-migrations.md) deferred the recipe tables. [0005](0005-v1-scope.md) is a household of two, a responsive PWA, an API, Postgres, and one cookbook MCP. [0022](0022-navigation-ia.md) still shows placeholder fields. This ADR proposes the v1 model and the document those tools read and write.

## Options considered

1. **One `jsonb` document per recipe.** A new key needs no migration, and the MCP payload can match the column. Required fields, ordered lines, and a save that forgot the steps all live in application code. Favorites, tags, and nutrition start as JSON and have to be lifted into columns later.
2. **Required structure on every ingredient.** Amount, unit, and name are mandatory, so scaling, a shopping list, and per-ingredient nutrition have a place to go. Lines such as "salt, to taste" and "1 (14 oz) can" do not fit. A writer that must fill the gaps will invent numbers. A unit catalog becomes its own project before anyone plans a week of meals.
3. **Relational recipe, free-text ingredient line, optional parse.** The cook always reads the original line. Amount, unit, and name are stored when the line is clear and left null when it is not. Tags, favorites, a nutrition summary, and a journal are real columns, so those queries do not scrape a document. The cost is a few joins. At household size that cost is noise. New facts are new nullable columns or new tables.

## Decision

Use option 3. Acceptance adopts **Proposed** and leaves **Open** unset. The first recipe change is a numbered SQL file applied by the API, the same runner as [0010](0010-migration-tooling.md). This ADR does not switch that runner to Drizzle or Prisma. Postgres 16 already provides `gen_random_uuid()`, so the migration adds no extension.

JSON keys are camelCase. SQL names are snake_case. The feature PR maps them. This PR adds no migration, no API, and no UI.

### Proposed

#### Recipe core

One row in `recipes` is one recipe. The cook-facing fields are:

| Field | Column | Rule |
| --- | --- | --- |
| Title | `title text` | Required. Trimmed. Not unique. Two recipes may share a title. |
| Description | `description text` | Optional. Short text for the list card. |
| Source URL | `source_url text` | Optional. The API accepts only `http:` and `https:`. A book or a person belongs in the label. |
| Source label | `source_label text` | Optional. Free text, one source. A sources table waits until a recipe has more than one. |
| Servings | `servings numeric` | Optional, greater than 0. The authored yield, including a cookie count. v1 does not write a scaled copy back. |
| Times | `prep_minutes`, `cook_minutes`, `total_minutes` | Optional integers, zero or greater. Total is stored on its own because rest time is not prep plus cook. |
| Steps | `recipe_steps` | Ordered rows. Array order on save becomes `position` starting at 1. Each step is plain text. |
| Notes | `notes text` | Optional standing tips that belong to the recipe. `save_recipe` replaces this text. Cooked-it notes go to the journal. |
| Photos | none | Deferred. See Open. |

Plain text only. The UI renders these strings as text.

#### Ingredients

`recipe_ingredients` stores one line per row. `line` is required and is the source of truth the cook sees. The parse sits beside it and may be null:

| Column | Role |
| --- | --- |
| `section text` | Optional group label, copied onto each line in the group ("Dressing"). |
| `amount numeric` | Optional, zero or greater. |
| `amount_max numeric` | Optional top of a range. Requires `amount`, and must be greater than or equal to it. |
| `unit text` | Optional free text. "clove", "can", and "splash" need no catalog. |
| `ingredient text` | Optional parsed food name, used for search. |
| `preparation text` | Optional. "rinsed", "to taste". |
| `optional boolean` | Default false. |

`(recipe_id, position)` is the primary key. A save replaces the whole set. The document's array order is that position. `position` is not a JSON field, and it is not a public id. A later fact about a line should be a new column on this table, which is an additive migration. A foreign key to a line id would break on every save.

Tags do not live on the line. Cuisine, course, and diet are recipe tags. Search for a food uses `line` and `ingredient`. A per-line label list ("produce", "pantry") can be a `text[]` column when a shopping list needs it.

The writer leaves a parsed field null when the line does not support it. "1 cup brown lentils, rinsed" can fill amount, unit, ingredient, and preparation. "salt, to taste" can fill ingredient and preparation and leave amount null. Inventing a number so the column is full is the failure this shape is there to avoid.

Required amount, unit, and name would reject honest lines or store fiction. Text alone, with columns added later, is an easy migration, and it throws away the parse Chef could have saved on the way in. These columns are the usual parse (quantity, unit, name, comment), so creating them now is the smaller bet. A canonical foods table is deferred. Matching on the text `ingredient` can grow a catalog later.

Unit conversion is deferred with meal planning. The unit column stays text so a new word is not a migration.

#### Tags, categories, and cuisine

One tag list. There is no category tree and no cuisine table.

`tags.slug` is the label, trimmed, case-folded, with internal whitespace collapsed. `tags.label` is the display text. The first label wins. `tags.kind` is `cuisine`, `course`, `diet`, or null. Null is a freeform label such as "weeknight" or "spicy". The API allowlist is those three kinds. A new kind is an API change, not a migration. A later save may fill a null kind. It does not replace a kind that is already set.

`recipe_tags` is the many-to-many. Removing a tag from a recipe leaves the `tags` row in place. Unused tags are harmless at this scale.

"Dinner" and "soup" are `course`. "Italian" is `cuisine`. "Vegetarian" is `diet`. A single primary category is not stored.

#### Favorites, ratings, notes, and cooking history

`recipes.favorite` is a household boolean, default false. `recipes.rating` is an optional household score from 1 to 5, or null when unrated. A favorite does not require a score, and a score does not put the recipe on the favorites list. [0005](0005-v1-scope.md) browses favorites. That list is `favorite = true`.

There are no accounts ([0005](0005-v1-scope.md)). A per-person star would need an actor on every phone tap. One shared list matches how the household cooks. A later ADR can add `recipe_flags(recipe_id, actor)` without rewriting recipe rows. Acceptance of this ADR locks the shared list.

Standing tips stay in `recipes.notes`. Dated personal notes and cooks go to `recipe_journal`, append-only:

| Column | Rule |
| --- | --- |
| `kind text` | `cook` or `note`. The API allowlist. No database check, so a new kind is not a migration. |
| `cooked_on date` | Required for `cook`. A calendar date, not a timestamp. |
| `note text` | Required and non-empty for `note`. Optional for `cook`. |
| `actor text` | Who wrote the entry. References `actors`. |

`save_recipe` has no journal field. The API rejects one. A save that replaces `notes` must not be able to drop history by sending an empty array. `add_journal_entry` appends. v1 tools do not update or delete journal rows. A typo is a later tool. `cookbook_app` may still `UPDATE` the table. It has DML on every table the migrator creates ([0013](0013-security-review.md)).

A new journal row updates the recipe's `updated_at`, so a cook brings the recipe back to the top of the list.

#### Nutrition

One optional `recipe_nutrition` row per recipe. The numbers are **per serving**. The row exists only when at least one number is set, and `servings_basis` is required on that row. It records the yield those numbers were divided by. Changing `recipes.servings` later does not rewrite the row.

| Column | Unit |
| --- | --- |
| `energy_kcal integer` | Food calories. Display can convert to kilojoules later. |
| `protein_g numeric` | Grams. |
| `carbohydrate_g numeric` | Grams. |
| `fat_g numeric` | Grams. |
| `fiber_g numeric` | Grams. |
| `source text` | `chef`, `manual`, or `label`. |
| `note text` | Optional. A place to say the figure is a rough estimate. |

Each number is optional and, when present, zero or greater. The API rejects a nutrition object whose numbers are all empty. `source` is required on the object. `chef` means Chef estimated it. `manual` means a person typed it. `label` means it was copied from a package or a published analysis. The UI can show `chef` as an estimate. The database does not check the vocabulary. The API does.

Sodium and any further nutrient are a nullable column when someone wants them. Per-ingredient nutrition and a food database are deferred. They need parsed amounts and a unit conversion this model does not have. A later table can reference `recipes` without moving these summary columns.

`nutrition` omitted on update leaves the row. `nutrition: null` deletes it.

#### Meal plans

The first migration has no meal-plan table. Weekly planning is still a later screen ([0022](0022-navigation-ia.md)). Favorites and tags are what browse needs until then. An empty plan table would freeze a shape (week grid, slots, leftovers) before anyone uses it. A later ADR can add rows that point at `recipes.id`. That shape is Open.

#### Identity, time, deletion, and actors

Primary keys on `recipes` and `recipe_journal` are `uuid`, default `gen_random_uuid()`. The client may send a recipe id. The same id on retry updates that row. Title is not an idempotency key.

`/recipes/:id` stays an opaque string ([0022](0022-navigation-ia.md)). The value is a uuid once the API is real. The example string ids in the design docs stay fixture ids until a feature wires them to Postgres.

`created_at` and `updated_at` are `timestamptz`, stored in UTC, serialized as ISO-8601. A `set_updated_at` trigger bumps `updated_at` on `recipes`, `recipe_nutrition`, and `tags`. Journal rows keep `created_at` only.

Soft delete is `recipes.deleted_at` plus `recipes.deleted_by`. List and get hide a row once `deleted_at` is set. Child rows stay. Soft delete is recovery, not erasure: the row remains in `pg_dump` ([0019](0019-data-dir-and-backups.md)). Clearing `deleted_at` is how a later undo would work. v1 has no restore tool and no hard-delete tool. A hard delete, when one exists, removes the recipe and cascades to lines, steps, tags links, nutrition, and journal. That is the erasure path, and it should be deliberate.

`actors` is a short list of slugs, not logins and not Postgres roles. The migration seeds two rows, which already appear in these public docs:

| slug | display name |
| --- | --- |
| `taylor` | Taylor |
| `chef` | Chef |

Slug shape is `^[a-z][a-z0-9_-]{0,31}$`. `created_by` is required. `updated_by` is set on each recipe update. `created_by` does not change after insert. Deleting an actor is refused while a row references it.

The MCP bearer token is one shared secret ([0003](0003-mcp-bearer-token.md)). `actor` on a tool call is who the caller claims to be. It is not authentication. Anyone who holds the token can name any actor. That matches a household of two on Tailscale. It is not an audit trail against a stolen token.

#### Search

v1 search is a query, not a table and not an extension. No `pg_trgm` and no `tsvector`. A household library is small enough for case-insensitive substring match. A generated `tsvector` column is a later additive migration.

`q` matches title, description, standing notes, ingredient `line`, parsed `ingredient`, step text, and tag label. It does not match the journal. A cook note ("burned it") should not file the recipe under that word. Favorite is a boolean filter. Each tag filter is an exact slug. Several tags are AND. `q` and the filters combine with AND.

List order is `updated_at` descending, then `id` descending. The cursor is that pair. Default page size 50, maximum 100.

Indexes in the sketch:

* live recipes by `(updated_at, id)`
* live favorites by `(updated_at, id)` where `favorite`
* `lower(ingredient)` where the parse is present
* `recipe_tags(tag_slug)`
* journal by `(recipe_id, created_at)`

#### MCP document and tools

MCP stays off the database network and calls the API ([0013](0013-security-review.md), [0006](0006-one-repo-one-mcp.md)). These are tool shapes for that feature PR. They are not registered here. Every tool sits behind the bearer token. `/health` stays status-only and returns no recipe.

Unknown keys are rejected. `photos` and `journal` on `save_recipe` are unknown keys.

On create, omitted optionals are empty: favorite false, rating null, tags `[]`, no nutrition row. On update, an omitted key is left as it is. `ingredients`, `steps`, and `title` are required on create and on update, and the arrays replace the stored set. That is the body of the recipe. A save that did not look at them is refused. `tags: []` clears tags. `nutrition: null` clears nutrition. `notes: null` clears standing notes.

`ifUpdatedAt`, when present, must equal the stored `updated_at`. Otherwise the API writes nothing and returns `conflict` with the current `updatedAt`. The client re-reads. When `ifUpdatedAt` is absent, the last save wins. The phone and Chef should send it. Two writers are why this store is Postgres ([0004](0004-postgres-migrations.md)).

A save whose id is soft-deleted does not revive the row. It returns `conflict`. A new recipe uses a new id.

| Tool | Hint | Body |
| --- | --- | --- |
| `list_recipes` | read-only | In: `favorite?`, `tag?` (repeatable), `q?`, `limit?`, `cursor?`. Out: summaries and `nextCursor`. Summary fields: `id`, `title`, `description`, `sourceLabel`, `servings`, `totalMinutes`, `tags`, `favorite`, `rating`, `nutrition` as `{ energyKcal, source }` or null, `updatedAt`. |
| `get_recipe` | read-only | In: `id`. Out: the document below, with `journal` ordered by `createdAt`. Missing and soft-deleted are `not_found`. |
| `save_recipe` | idempotent | In: the document fields, plus required `actor`, optional `ifUpdatedAt`. No journal. Out: the stored document. |
| `set_favorite` | idempotent | In: `id`, `favorite`, `actor`, `ifUpdatedAt?`. |
| `set_rating` | idempotent | In: `id`, `rating` (1–5 or null), `actor`, `ifUpdatedAt?`. |
| `add_journal_entry` | not idempotent | In: `recipeId`, `kind`, `cookedOn?`, `note?`, `actor`. Out: the new entry. |
| `delete_recipe` | destructive | In: `id`, `actor`, `ifUpdatedAt?`. Sets `deleted_at`. A second call is `not_found`. |

Errors are `{ "error": "not_found" | "conflict" | "invalid", "message": "..." }`. The message has no SQL and no token. `conflict` carries `updatedAt` and not the recipe body.

#### Security

Recipes, standing notes, journal notes, nutrition, and source URLs are household data. They stay in Postgres on the NAS ([0007](0007-public-repo-secrets.md)). This ADR's JSON is an illustration. It is not seed, and it is not a household recipe. The feature PR does not insert it.

The backup is `pg_dump`, mode `0600`, and it includes soft-deleted rows and journal text ([0019](0019-data-dir-and-backups.md)). A database password does not encrypt that dump or the data directory. Disk encryption for a drive that leaves the house stays the control in [0013](0013-security-review.md). Column encryption is out of scope: it would fight ordinary search and this document shape, and it would not change what the app role can read.

The migration runs as `cookbook_migrator`. New tables pick up the existing default DML grants for `cookbook_app`. This model adds no role, no grant to MCP, and no row level security. The one new grant is `EXECUTE` on `set_updated_at()` for `cookbook_app`. MCP never receives a database login.

Health checks stay status-only. Logs, errors, fixtures, and demos do not include recipe bodies, notes, journal text, nutrition tied to a real meal, tokens, or tailnet names. The UI links `sourceUrl` only for `http:` and `https:`.

`created_by` names an actor. It does not prove who called the tool.

### Document illustration

Invented for this shape. Title prefix `Example:`. URL host `example.com`. Not seed data.

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "title": "Example: Tomato lentils",
  "description": "A weeknight pot of lentils. Illustration only.",
  "sourceUrl": "https://example.com/tomato-lentils",
  "sourceLabel": "Example site",
  "servings": 4,
  "prepMinutes": 10,
  "cookMinutes": 35,
  "totalMinutes": 45,
  "notes": "Illustration: rest the pot for five minutes.",
  "ingredients": [
    {
      "section": null,
      "line": "1 cup brown lentils, rinsed",
      "amount": 1,
      "amountMax": null,
      "unit": "cup",
      "ingredient": "brown lentils",
      "preparation": "rinsed",
      "optional": false
    },
    {
      "section": null,
      "line": "salt, to taste",
      "amount": null,
      "amountMax": null,
      "unit": null,
      "ingredient": "salt",
      "preparation": "to taste",
      "optional": false
    }
  ],
  "steps": [
    { "text": "Rinse the lentils." },
    { "text": "Simmer with tomatoes until the lentils are tender." }
  ],
  "tags": [
    { "slug": "weeknight", "label": "Weeknight", "kind": null },
    { "slug": "stew", "label": "Stew", "kind": "course" }
  ],
  "favorite": true,
  "rating": 4,
  "nutrition": {
    "energyKcal": 320,
    "proteinG": 18,
    "carbohydrateG": 48,
    "fatG": 4,
    "fiberG": 12,
    "servingsBasis": 4,
    "source": "chef",
    "note": "Estimated. Not a lab value."
  },
  "journal": [
    {
      "id": "00000000-0000-4000-8000-000000000002",
      "kind": "cook",
      "cookedOn": "2026-10-27",
      "note": "Illustration: used less salt.",
      "actor": "taylor",
      "createdAt": "2026-10-27T18:00:00Z"
    }
  ],
  "createdBy": "chef",
  "updatedBy": "taylor",
  "createdAt": "2026-10-27T15:00:00Z",
  "updatedAt": "2026-10-27T18:00:00Z",
  "deletedAt": null
}
```

`save_recipe` sends the same object without `journal`, `createdAt`, `updatedAt`, and `deletedAt`, and adds `actor`. Tag writes may send `label` and `kind`. The API fills `slug`.

### Table sketch

Sketch for the feature migration. Not applied here. The feature PR takes the next free file in `db/migrations/` ([parallel agents](../parallel-agents.md)). No down migration ([0020](0020-update-and-rollback.md)).

```sql
CREATE TABLE actors (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z][a-z0-9_-]{0,31}$'),
  display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  description text,
  source_url text,
  source_label text,
  servings numeric CHECK (servings IS NULL OR servings > 0),
  prep_minutes integer CHECK (prep_minutes IS NULL OR prep_minutes >= 0),
  cook_minutes integer CHECK (cook_minutes IS NULL OR cook_minutes >= 0),
  total_minutes integer CHECK (total_minutes IS NULL OR total_minutes >= 0),
  notes text,
  favorite boolean NOT NULL DEFAULT false,
  rating smallint CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  created_by text NOT NULL REFERENCES actors (slug),
  updated_by text REFERENCES actors (slug),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by text REFERENCES actors (slug),
  CHECK (deleted_at IS NULL OR deleted_by IS NOT NULL)
);

CREATE TABLE recipe_steps (
  recipe_id uuid NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 1),
  text text NOT NULL CHECK (length(btrim(text)) > 0),
  PRIMARY KEY (recipe_id, position)
);

CREATE TABLE recipe_ingredients (
  recipe_id uuid NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 1),
  section text CHECK (section IS NULL OR length(btrim(section)) > 0),
  line text NOT NULL CHECK (length(btrim(line)) > 0),
  amount numeric CHECK (amount IS NULL OR amount >= 0),
  amount_max numeric,
  unit text,
  ingredient text,
  preparation text,
  optional boolean NOT NULL DEFAULT false,
  PRIMARY KEY (recipe_id, position),
  CHECK (
    amount_max IS NULL
    OR (amount IS NOT NULL AND amount_max >= amount)
  )
);

CREATE TABLE tags (
  slug text PRIMARY KEY CHECK (length(btrim(slug)) > 0 AND slug = lower(slug)),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  kind text CHECK (kind IS NULL OR length(btrim(kind)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recipe_tags (
  recipe_id uuid NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
  tag_slug text NOT NULL REFERENCES tags (slug),
  PRIMARY KEY (recipe_id, tag_slug)
);

CREATE TABLE recipe_nutrition (
  recipe_id uuid PRIMARY KEY REFERENCES recipes (id) ON DELETE CASCADE,
  energy_kcal integer CHECK (energy_kcal IS NULL OR energy_kcal >= 0),
  protein_g numeric CHECK (protein_g IS NULL OR protein_g >= 0),
  carbohydrate_g numeric CHECK (carbohydrate_g IS NULL OR carbohydrate_g >= 0),
  fat_g numeric CHECK (fat_g IS NULL OR fat_g >= 0),
  fiber_g numeric CHECK (fiber_g IS NULL OR fiber_g >= 0),
  servings_basis numeric NOT NULL CHECK (servings_basis > 0),
  source text NOT NULL CHECK (length(btrim(source)) > 0),
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text REFERENCES actors (slug),
  CHECK (
    energy_kcal IS NOT NULL
    OR protein_g IS NOT NULL
    OR carbohydrate_g IS NOT NULL
    OR fat_g IS NOT NULL
    OR fiber_g IS NOT NULL
  )
);

CREATE TABLE recipe_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (length(btrim(kind)) > 0),
  cooked_on date,
  note text,
  actor text NOT NULL REFERENCES actors (slug),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recipes_live_updated_idx
  ON recipes (updated_at DESC, id) WHERE deleted_at IS NULL;
CREATE INDEX recipes_live_favorite_idx
  ON recipes (updated_at DESC, id) WHERE deleted_at IS NULL AND favorite;
CREATE INDEX recipe_ingredients_name_idx
  ON recipe_ingredients (lower(ingredient)) WHERE ingredient IS NOT NULL;
CREATE INDEX recipe_tags_slug_idx ON recipe_tags (tag_slug);
CREATE INDEX recipe_journal_recipe_idx
  ON recipe_journal (recipe_id, created_at);

INSERT INTO actors (slug, display_name) VALUES
  ('taylor', 'Taylor'),
  ('chef', 'Chef')
ON CONFLICT (slug) DO NOTHING;

CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_updated_at() TO cookbook_app;

CREATE TRIGGER recipes_set_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER recipe_nutrition_set_updated_at
  BEFORE UPDATE ON recipe_nutrition
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tags_set_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

The file does not wrap itself in `BEGIN`. The runner already does. Postgres grants `EXECUTE` on a new function to `PUBLIC`. The sketch revokes that and grants it to `cookbook_app`, which is the role that fires the trigger. `PUBLIC` cannot `CONNECT` ([0013](0013-security-review.md)). The revoke keeps the function off the default grant.

### Open

Acceptance does not decide these.

* The slug and display name of the other household cook, and whether either string is committed. The seed above is only `taylor` and `chef`.
* Which actor the phone sends. The column is required and has no default. A settings control can remember the choice. That control is a later feature.
* Meal-plan columns. Proposed already keeps them out of the first migration. The later shape is unset.
* Where photo files live. Proposed already stores none. A later decision can add `recipe_photos` and a directory under `COOKBOOK_DATA_DIR`. [0019](0019-data-dir-and-backups.md) does not list that directory today.
* Per-ingredient nutrition, a foods catalog, and unit conversion.
* Sodium and any nutrient beyond energy and the four gram columns.
* Drizzle or Prisma. [0010](0010-migration-tooling.md) stays in force. Accepting this ADR keeps numbered SQL for the recipe migration.
* Restore and hard-delete tools. Proposed already omits both. The columns allow an undo. Erasure is a cascade delete.
* A `tsvector` column. Proposed search is substring match.

## Consequences

* After acceptance, a feature PR may add the tables. [0004](0004-postgres-migrations.md) stays the record that the foundation shipped without them. This ADR does not edit it.
* [0022](0022-navigation-ia.md) still shows placeholder meta. A UI feature reads this model when Taylor wants that screen to change. Search, plan, and photos stay off that screen until their own work.
* `db/seed.sql` stays the platform seed. No example recipe is inserted. Real recipes stay out of git ([0007](0007-public-repo-secrets.md)).
* The illustration in this file is the shape Chef should be able to round-trip. Tool registration, HTTP paths, and the TypeScript types belong to the feature PR. Types that web, API, and MCP share follow [0009](0009-repo-layout.md) and [0012](0012-parallel-agents.md).
* Soft-deleted recipes and journal notes are inside the plaintext dump. Deleting a recipe in the app hides it. It does not remove it from the last backup.
* `cookbook_app` gains DML on the new tables through the grants [0013](0013-security-review.md) already set. It still has no `CREATE`.
