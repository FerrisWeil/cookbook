import { Message } from "@cookbook/ui";
import { useEffect, useState } from "react";

import { ListScreen } from "./ListScreen";
import { leaveRecipe, pushAppPath } from "./navigate";
import { parseRoute } from "./route";
import { RecipeScreen } from "./RecipeScreen";
import { KitchenProvider, useRecipe, useRecipeList } from "./useKitchen";
import { useRecipeFactsEditor } from "./useRecipeFactsEditor";
import type { KitchenSession } from "./sync/session";

export function App({
  initialPath,
  session,
}: {
  initialPath?: string;
  session?: KitchenSession;
} = {}) {
  return (
    <KitchenProvider session={session}>
      <AppRoutes initialPath={initialPath} />
    </KitchenProvider>
  );
}

function AppRoutes({ initialPath }: { initialPath?: string }) {
  const [path, setPath] = useState(() => initialPath ?? currentPath());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function go(to: string) {
    if (typeof window !== "undefined") {
      pushAppPath(to, window.history, window.location);
    }
    setPath(to);
  }

  function backToList() {
    if (typeof window === "undefined") {
      setPath("/");
      return;
    }
    if (leaveRecipe(window.history) === "replace") {
      setPath("/");
    }
  }

  const route = parseRoute(path);
  if (route.name === "recipe") {
    return <RecipeRoute id={route.id} onBack={backToList} />;
  }
  if (route.name === "list") {
    return <ListRoute onOpen={go} />;
  }
  return (
    <main className="ui-shell">
      <Message>That screen is not available.</Message>
    </main>
  );
}

function currentPath(): string {
  if (typeof window === "undefined") {
    return "/";
  }
  return window.location.pathname;
}

function ListRoute({ onOpen }: { onOpen: (href: string) => void }) {
  const { state, retry, status } = useRecipeList();
  return (
    <ListScreen
      state={state}
      onOpen={onOpen}
      onRetry={retry}
      status={status.label}
    />
  );
}

function RecipeRoute({ id, onBack }: { id: string; onBack: () => void }) {
  const { state, retry, status } = useRecipe(id);
  const facts = state.kind === "ready" ? state.recipe.facts : null;
  const editor = useRecipeFactsEditor({
    recipeId: id,
    facts,
    onCommitted() {
      void retry();
    },
  });
  return (
    <RecipeScreen
      state={state}
      editing={editor.editing}
      draft={editor.draft}
      formStatus={editor.status}
      onBack={onBack}
      onRetry={retry}
      status={status.label}
      onEditFacts={editor.open}
      onDraftChange={editor.changeDraft}
      onSaveFacts={(next) => {
        void editor.save(next);
      }}
      onCancelFacts={editor.cancel}
    />
  );
}
