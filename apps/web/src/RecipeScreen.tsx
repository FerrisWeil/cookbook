import { Button, Message } from "@cookbook/ui";

import type { RecipeFacts } from "@cookbook/shared";

import { RECIPE_ERROR, RECIPE_MISSING, type RecipeView } from "./api";
import { RecipeFactsForm } from "./RecipeFactsForm";
import { RecipeFacts as RecipeFactsDisplay } from "./RecipeFacts";
import type { FactsDraft, FactsFormStatus } from "./facts";

export type RecipeState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "missing" }
  | { kind: "ready"; recipe: RecipeView };

export function RecipeScreen({
  state,
  editing,
  draft,
  baseline,
  formStatus,
  onBack,
  onRetry,
  status,
  onEditFacts,
  onDraftChange,
  onSaveFacts,
  onCancelFacts,
}: {
  state: RecipeState;
  editing: boolean;
  draft: FactsDraft | null;
  baseline?: RecipeFacts | null;
  formStatus: FactsFormStatus;
  onBack: () => void;
  onRetry: () => void;
  status?: string;
  onEditFacts: () => void;
  onDraftChange: (draft: FactsDraft) => void;
  onSaveFacts: (fields: Partial<RecipeFacts>) => void;
  onCancelFacts: () => void;
}) {
  return (
    <main className="ui-shell recipe-screen">
      <Button className="ui-back" variant="primary" onClick={onBack}>
        Back
      </Button>
      {status ? (
        <p className="sync-status" role="status">
          {status}
        </p>
      ) : null}
      {state.kind === "loading" ? <LoadingRecipe /> : null}
      {state.kind === "error" ? (
        <Message>
          <p>{state.message || RECIPE_ERROR}</p>
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
        </Message>
      ) : null}
      {state.kind === "missing" ? <Message>{RECIPE_MISSING}</Message> : null}
      {state.kind === "ready" ? (
        <RecipeArticle
          recipe={state.recipe}
          editing={editing}
          draft={draft}
          baseline={baseline ?? state.recipe.facts}
          formStatus={formStatus}
          onEditFacts={onEditFacts}
          onDraftChange={onDraftChange}
          onSaveFacts={onSaveFacts}
          onCancelFacts={onCancelFacts}
        />
      ) : null}
    </main>
  );
}

function LoadingRecipe() {
  return (
    <div className="recipe-skeleton" aria-busy="true" aria-label="Loading recipe">
      <div className="recipe-skeleton-title" />
      <div className="recipe-skeleton-block" />
      <div className="recipe-skeleton-block" />
    </div>
  );
}

export function RecipeArticle({
  recipe,
  editing,
  draft,
  baseline,
  formStatus,
  onEditFacts,
  onDraftChange,
  onSaveFacts,
  onCancelFacts,
}: {
  recipe: RecipeView;
  editing: boolean;
  draft: FactsDraft | null;
  baseline: RecipeFacts;
  formStatus: FactsFormStatus;
  onEditFacts: () => void;
  onDraftChange: (draft: FactsDraft) => void;
  onSaveFacts: (fields: Partial<RecipeFacts>) => void;
  onCancelFacts: () => void;
}) {
  return (
    <article className="recipe-article">
      <h1>{recipe.title}</h1>
      <div className="recipe-facts-block">
        <RecipeFactsDisplay facts={recipe.facts} explanations="focusable" />
        {editing && draft ? (
          <RecipeFactsForm
            draft={draft}
            baseline={baseline}
            status={formStatus}
            onDraftChange={onDraftChange}
            onSave={onSaveFacts}
            onCancel={onCancelFacts}
          />
        ) : (
          <Button variant="tonal" onClick={onEditFacts}>
            Edit recipe facts
          </Button>
        )}
      </div>
      {recipe.ingredients.length > 0 ? (
        <section>
          <h2>Ingredients</h2>
          <ul>
            {recipe.ingredients.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {recipe.steps.length > 0 ? (
        <section>
          <h2>Steps</h2>
          <ol>
            {recipe.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </section>
      ) : null}
    </article>
  );
}
