# 0020. What a recipe leaves out

* Status: accepted
* Date: 2026-11-01
* Confirmed: Taylor, 2026-11-01

## Problem

A recipe record grows fields the kitchen never shows, and later work treats those absences as unfinished.

## Options considered

1. **Store only what the kitchen shows** — photos, notes, and the rest stay out until a later decision.
2. **Reserve the extra fields now** — the record matches a bigger product before any screen uses it.

## Decision

v1 stores no photo, note, tag, journal, recipe source, or time. It has no search and no meal plan.

The written ingredient line is the source of truth. The only parsed fields are amount, unit, and name.

Nutrition is one optional per-serving row. It does not fix which nutrients that row contains, and it has no per-ingredient figures.

Delete hides the recipe. The row stays. There is no restore and no erase.

## Consequences

A later feature that adds one of these is a new decision.

The phone still sets only favorite and rating.
