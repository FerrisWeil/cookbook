# Recipes

Category F2. Status: Proposed.

Drawn from the accepted decisions. Taylor answered the open questions in chat. Each statement stays Proposed until he accepts it.

## F2.1 Ingredient line

Status: Proposed.

The ingredient line is the source of truth.

### F2.1.1 Parsed fields

Status: Proposed.

Amount, unit, and name may be empty.

### F2.1.2 No invented parse

Status: Proposed.

A parsed amount, unit, or name stays empty when the line does not state it.

### F2.1.3 Only those fields

Status: Proposed.

The only parsed fields are amount, unit, and name.

## F2.2 Favorite

Status: Proposed.

A recipe has one favorite.

### F2.2.1 Shared

Status: Proposed.

The favorite is the household's.

## F2.3 Rating

Status: Proposed.

A rating is optional and is a whole number from 1 to 5.

### F2.3.1 Independent

Status: Proposed.

A rating does not change the favorite. A favorite does not require a rating.

## F2.4 Nutrition

Status: Proposed.

A recipe has at most one nutrition row. The numbers are per serving.

### F2.4.1 Source

Status: Proposed.

The source is `chef`, `manual`, or `label`.

### F2.4.3 Divisor

Status: Proposed.

Nutrition numbers are per serving. The divisor is the recipe's stored servings.

### F2.4.4 Nutrients

Status: Proposed.

v1 names no required nutrient and has no per-ingredient nutrition.

## F2.5 Delete

Status: Proposed.

A deleted recipe is hidden from read and from list.

### F2.5.1 Kept

Status: Proposed.

The recipe stays stored. v1 has no restore and no erase.

### F2.5.2 No revive

Status: Proposed.

A later save does not make a deleted recipe visible again.

## F2.6 Photos and meal plans

Status: Proposed.

v1 has no photo and no meal plan.

## F2.7 Actors

Status: Proposed.

The actors shipped in git are `taylor` and `chef`.

### F2.7.1 No default

Status: Proposed.

An actor field has no default.

### F2.7.2 Other cooks

Status: Proposed.

Git ships no other actor. Another cook is added on the NAS, outside git.

## F2.8 Title

Status: Proposed.

A recipe has a non-empty title.

### F2.8.1 Duplicates

Status: Proposed.

Two recipes may share a title.

## F2.9 Steps

Status: Proposed.

Steps are stored in the order they were saved.

## F2.10 Servings

Status: Proposed.

A recipe has servings greater than zero.

## F2.11 Left out

Status: Proposed.

v1 stores no notes, tags, journal, source, or times, and it has no search.
