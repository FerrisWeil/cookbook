## F2 Recipes

F2.1 The ingredient line is the source of truth.
- F2.1.1 Amount, unit, and name may be empty. [Proposed]
- F2.1.2 A parsed amount, unit, or name stays empty when the line does not state it. [Proposed]
- F2.1.3 The only parsed fields are amount, unit, and name. [Proposed]

F2.2 A recipe has a favorite flag.
- F2.2.1 A recipe has one favorite. [Proposed]
- F2.2.2 The favorite is the household's. [Proposed]

F2.3 A recipe may have a rating.
- F2.3.1 A rating is optional. [Proposed]
- F2.3.2 A rating is a whole number from 1 to 5. [Proposed]
- F2.3.3 A rating does not change the favorite. [Proposed]
- F2.3.4 A favorite does not require a rating. [Proposed]

F2.4 A recipe may have nutrition.
- F2.4.1 A recipe has at most one nutrition row. [Proposed]
- F2.4.2 The numbers are per serving. [Proposed]
- F2.4.3 The source is `chef`, `manual`, or `label`. [Proposed]
- F2.4.4 The divisor is the recipe's stored servings. [Proposed]
- F2.4.5 That servings is greater than zero. [Proposed]
- F2.4.6 v1 does not fix which nutrients a row contains. [Proposed]
- F2.4.7 v1 has no per-ingredient nutrition. [Proposed]

F2.5 Delete hides a recipe.
- F2.5.1 A deleted recipe is hidden from read and from list. [Proposed]
- F2.5.2 The recipe stays stored. [Proposed]
- F2.5.3 v1 has no restore. [Proposed]
- F2.5.4 v1 has no erase. [Proposed]
- F2.5.5 A later save does not make a deleted recipe visible again. [Proposed]

F2.6 v1 leaves photos and meal plans out.
- F2.6.1 v1 stores no photo. [Proposed]
- F2.6.2 v1 stores no meal plan. [Proposed]

F2.7 Git ships the household actors.
- F2.7.1 The actors shipped in git are `taylor` and `chef`. [Proposed]
- F2.7.2 An actor field has no default. [Proposed]
- F2.7.3 Git ships no other actor. [Proposed]
- F2.7.4 Another cook is added on the NAS, outside git. [Proposed]

F2.8 A recipe has a title.
- F2.8.1 The title is non-empty. [Proposed]
- F2.8.2 Two recipes may share a title. [Proposed]

F2.9 A recipe stores steps.
- F2.9.1 Steps are stored in the order they were saved. [Proposed]

F2.10 A recipe has servings.
- F2.10.1 A recipe stores its servings. [Proposed]

F2.11 v1 leaves notes, tags, a journal, a recipe source, times, and search out.
- F2.11.1 v1 stores no notes. [Proposed]
- F2.11.2 v1 stores no tags. [Proposed]
- F2.11.3 v1 stores no journal. [Proposed]
- F2.11.4 v1 stores no recipe source. [Proposed]
- F2.11.5 v1 stores no times. [Proposed]
- F2.11.6 v1 has no search. [Proposed]
