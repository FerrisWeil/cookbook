# Recipes

Category F2. Status: Proposed.

Drawn from the accepted decisions, including the confirmed recipe positions. Each statement stays Proposed until Taylor accepts it.

## F2.1 Ingredient line

Status: Proposed.

The ingredient line is the text the cook reads.

### F2.1.1 Parsed fields

Status: Proposed.

Amount, unit, and name may be empty.

### F2.1.2 No invented parse

Status: Proposed.

A save leaves a parsed field empty when the line does not support it.

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

### F2.4.2 Optional row

Status: Proposed.

The row exists only when at least one number is set. The source is then required.

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
