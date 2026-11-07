import { Button, Message } from "@cookbook/ui";

import { RECIPE_ERROR, RECIPE_MISSING, type RecipeView } from "./api";

export type RecipeState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "missing" }
  | { kind: "ready"; recipe: RecipeView };

export function RecipeScreen({
  state,
  onBack,
  onRetry,
}: {
  state: RecipeState;
  onBack: () => void;
  onRetry: () => void;
}) {
  return (
    <main className="ui-shell recipe-screen">
      <Button className="ui-back" variant="primary" onClick={onBack}>
        Back
      </Button>
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
      {state.kind === "ready" ? <RecipeArticle recipe={state.recipe} /> : null}
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

export function RecipeArticle({ recipe }: { recipe: RecipeView }) {
  return (
    <article className="recipe-article">
      <h1>{recipe.title}</h1>
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
