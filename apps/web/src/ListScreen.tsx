import type { RecipeListItem } from "@cookbook/shared";
import { Button, Card, Message, SkeletonCard } from "@cookbook/ui";

import { LIST_ERROR } from "./api";
import { factsAccessibleSummary } from "./facts";
import { RecipeFacts } from "./RecipeFacts";
import { recipePath } from "./route";

export type ListState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; recipes: RecipeListItem[] };

export function ListScreen({
  state,
  onOpen,
  onRetry,
}: {
  state: ListState;
  onOpen: (href: string) => void;
  onRetry: () => void;
}) {
  return (
    <main className="ui-shell">
      <h1>Recipes</h1>
      {state.kind === "loading" ? <LoadingList /> : null}
      {state.kind === "error" ? (
        <Message>
          <p>{state.message || LIST_ERROR}</p>
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
        </Message>
      ) : null}
      {state.kind === "ready" && state.recipes.length === 0 ? (
        <Message tone="info">No recipes yet.</Message>
      ) : null}
      {state.kind === "ready" && state.recipes.length > 0 ? (
        <ul className="recipe-grid">
          {state.recipes.map((recipe) => (
            <li key={recipe.id}>
              <Card
                href={recipePath(recipe.id)}
                title={recipe.title}
                aria-label={`${recipe.title}. ${factsAccessibleSummary(recipe.facts)}`}
                meta={
                  <RecipeFacts facts={recipe.facts} explanations="hover" />
                }
                onNavigate={onOpen}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}

function LoadingList() {
  return (
    <ul className="recipe-grid" aria-busy="true" aria-label="Loading recipes">
      <li>
        <SkeletonCard />
      </li>
      <li>
        <SkeletonCard />
      </li>
      <li>
        <SkeletonCard />
      </li>
    </ul>
  );
}
