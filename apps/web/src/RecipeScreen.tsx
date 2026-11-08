import { Button, Message } from "@cookbook/ui";

import type { RecipeFacts } from "@cookbook/shared";

import { RECIPE_ERROR, RECIPE_MISSING, type RecipeView } from "./api";
import type { CookingPanel } from "./useCookingSession";
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
  cooking,
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
  cooking?: CookingPanel;
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
          cooking={cooking}
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
  cooking,
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
  cooking?: CookingPanel;
}) {
  const title = cooking?.mode === "here" ? cooking.session.snapshot.title : recipe.title;
  const ingredients =
    cooking?.mode === "here" ? cooking.session.snapshot.ingredients : recipe.ingredients;
  const steps = cooking?.mode === "here" ? cooking.session.snapshot.steps : recipe.steps;
  return (
    <article className="recipe-article">
      <h1>{title}</h1>
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
      {ingredients.length > 0 ? (
        <section>
          <h2>Ingredients</h2>
          <ul>
            {ingredients.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {steps.length > 0 ? (
        <section>
          <h2>Steps</h2>
          <ol className={cooking?.mode === "here" ? "cooking-steps" : undefined}>
            {steps.map((step, index) => {
              const current = cooking?.mode === "here" && cooking.session.displayedStep === index;
              const done =
                cooking?.mode === "here" && cooking.session.completedSteps.includes(index);
              return (
                <li key={index} className={current ? "step-current" : undefined} aria-current={current ? "step" : undefined}>
                  {done ? <span className="step-done">Done. </span> : null}
                  {step}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
      {cooking ? <CookingControls cooking={cooking} /> : null}
    </article>
  );
}

function CookingControls({ cooking }: { cooking: CookingPanel }) {
  return (
    <div className="cooking-session">
      {cooking.error ? <Message>{cooking.error}</Message> : null}
      {cooking.mode === "idle" ? (
        <Button variant="primary" onClick={cooking.onStart}>
          Start cooking
        </Button>
      ) : null}
      {cooking.mode === "elsewhere" ? (
        <Button variant="primary" onClick={cooking.onOpen}>
          {`Cooking ${cooking.title}`}
        </Button>
      ) : null}
      {cooking.mode === "here" ? (
        <div className="cooking-actions">
          <Button
            onClick={() => cooking.onShow(cooking.session.displayedStep - 1)}
            disabled={cooking.session.displayedStep === 0}
          >
            Previous step
          </Button>
          <Button
            onClick={() => cooking.onShow(cooking.session.displayedStep + 1)}
            disabled={cooking.session.displayedStep >= cooking.session.snapshot.steps.length - 1}
          >
            Next step
          </Button>
          {cooking.session.completedSteps.includes(cooking.session.displayedStep) ? (
            <Button onClick={cooking.onUndo}>Undo this step</Button>
          ) : (
            <Button variant="primary" onClick={cooking.onComplete}>
              Mark this step done
            </Button>
          )}
          <Button variant="danger" onClick={cooking.onFinish}>
            Finish cooking
          </Button>
        </div>
      ) : null}
    </div>
  );
}
