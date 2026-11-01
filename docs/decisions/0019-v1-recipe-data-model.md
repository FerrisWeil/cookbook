# 0019. v1 recipe data model

* Status: proposed
* Date: 2026-10-27

## Problem

Chef saves recipes and Taylor browses favorites, including nutrition, on a model that still has to grow.

## Options considered

1. **One document per recipe** — a new fact needs no migration, and favorites, tags, and nutrition have to be lifted out later.
2. **A required quantity on every ingredient** — scaling is easy, and a line such as "to taste" gets an invented number.
3. **A relational recipe, written line first** — the cook reads the original wording, and a parse is kept only when the line supports it.

## Decision

A relational recipe. The written ingredient line is the source of truth. Amount, unit, and name are optional.

Tags are one list. Cuisine and course are tags.

Favorite is one shared flag. Rating is one optional score from one to five. Not a separate score per person.

Tips that belong to the recipe stay on the recipe. Cooks and personal notes are a history. Saving the recipe does not erase that history.

Nutrition is one optional per-serving summary, named as estimated, entered, or copied. Not a figure per ingredient.

The first model has no meal plan and no photos.

Deleting a recipe hides it and keeps the row.

Who wrote a row is a named person, not a login. Git names only Taylor and Chef. The phone chooses the person later. No person is assumed.

A recipe keeps a stable identity when the title changes.

## Consequences

* Schema changes stay ordered SQL ([0010](0010-migration-tooling.md)). This decision adds no ORM.
* Real recipes stay out of git ([0007](0007-public-repo-secrets.md)). The foundation left the schema open ([0004](0004-postgres-migrations.md)).
* The three screens stay as they are ([0016](0016-kitchen-ui.md)) until a feature reads this model.
* Not decided here: the meal-plan shape, where photos live, per-ingredient nutrition, full-text search, and a tool that restores or erases a hidden recipe.
* Columns, tool shapes, and search mechanics are requirements, not this file.
