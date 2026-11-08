import {
  RECIPE_MEAL_TYPES,
  RECOMMENDED_PROTEINS,
  type RecipeFacts,
  type RecipeMealType,
} from "@cookbook/shared";
import { Button } from "@cookbook/ui";
import { type FormEvent } from "react";

import {
  factsFromDraft,
  formatMealType,
  type FactsDraft,
  type FactsFormStatus,
} from "./facts";

export type { FactsFormStatus };

export function RecipeFactsForm({
  draft,
  status,
  onDraftChange,
  onSave,
  onCancel,
}: {
  draft: FactsDraft;
  status: FactsFormStatus;
  onDraftChange: (draft: FactsDraft) => void;
  onSave: (next: RecipeFacts) => void;
  onCancel: () => void;
}) {
  const submitting = status.kind === "submitting";

  function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    onSave(factsFromDraft(draft));
  }

  function toggleMeal(meal: RecipeMealType) {
    const present = draft.mealTypes.includes(meal);
    onDraftChange({
      ...draft,
      mealTypes: present
        ? draft.mealTypes.filter((item) => item !== meal)
        : [...draft.mealTypes, meal],
    });
  }

  return (
    <form className="facts-form" onSubmit={submit} aria-labelledby="facts-form-title">
      <h2 id="facts-form-title">Edit recipe facts</h2>
      <p className="facts-form-help">
        Recommended primary proteins: {RECOMMENDED_PROTEINS.join(", ")}. Other
        names are allowed. Total time is whole minutes including prep and waiting.
        Leave a field empty to clear it.
      </p>
      <label className="facts-field">
        <span>Primary protein</span>
        <input
          type="text"
          name="primaryProtein"
          maxLength={80}
          value={draft.primaryProtein}
          onChange={(event) =>
            onDraftChange({ ...draft, primaryProtein: event.target.value })
          }
          autoComplete="off"
          disabled={submitting}
        />
      </label>
      <label className="facts-field">
        <span>Total time (minutes)</span>
        <input
          type="number"
          name="totalMinutes"
          inputMode="numeric"
          min={0}
          max={10080}
          step={1}
          value={draft.totalMinutes}
          onChange={(event) =>
            onDraftChange({ ...draft, totalMinutes: event.target.value })
          }
          disabled={submitting}
        />
      </label>
      <fieldset className="facts-field" disabled={submitting}>
        <legend>Effort</legend>
        <label>
          <input
            type="radio"
            name="effort"
            value=""
            checked={draft.effort === ""}
            onChange={() => onDraftChange({ ...draft, effort: "" })}
          />
          Not specified
        </label>
        <label>
          <input
            type="radio"
            name="effort"
            value="low"
            checked={draft.effort === "low"}
            onChange={() => onDraftChange({ ...draft, effort: "low" })}
          />
          Low
        </label>
        <label>
          <input
            type="radio"
            name="effort"
            value="medium"
            checked={draft.effort === "medium"}
            onChange={() => onDraftChange({ ...draft, effort: "medium" })}
          />
          Medium
        </label>
        <label>
          <input
            type="radio"
            name="effort"
            value="high"
            checked={draft.effort === "high"}
            onChange={() => onDraftChange({ ...draft, effort: "high" })}
          />
          High
        </label>
      </fieldset>
      <fieldset className="facts-field" disabled={submitting}>
        <legend>Meal types</legend>
        {RECIPE_MEAL_TYPES.map((meal) => (
          <label key={meal}>
            <input
              type="checkbox"
              name="mealTypes"
              value={meal}
              checked={draft.mealTypes.includes(meal)}
              onChange={() => toggleMeal(meal)}
            />
            {formatMealType(meal)}
          </label>
        ))}
      </fieldset>
      {status.kind === "error" ? (
        <p className="facts-form-error" role="alert">
          {status.message}
        </p>
      ) : null}
      <div className="facts-form-actions">
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Saving" : status.kind === "error" ? "Try again" : "Save"}
        </Button>
        <Button type="button" variant="quiet" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
