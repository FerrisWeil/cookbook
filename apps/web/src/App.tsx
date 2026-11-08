import { Message } from "@cookbook/ui";
import { useEffect, useState } from "react";

import type { CookingClient } from "./cooking/client";
import { ListScreen } from "./ListScreen";
import { leaveRecipe, pushAppPath } from "./navigate";
import { parseRoute } from "./route";
import { RecipeScreen } from "./RecipeScreen";
import { CookingProvider, cookingPanel, useCookingSession } from "./useCookingSession";
import { KitchenProvider, useRecipe, useRecipeList } from "./useKitchen";
import type { KitchenSession } from "./sync/session";

export function App({
  initialPath,
  session,
  cooking,
}: {
  initialPath?: string;
  session?: KitchenSession;
  cooking?: CookingClient;
} = {}) {
  return (
    <KitchenProvider session={session}>
      <CookingProvider client={cooking}>
        <AppRoutes initialPath={initialPath} />
      </CookingProvider>
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
    return <RecipeRoute id={route.id} onBack={backToList} onOpen={go} />;
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
  const { state, retry, status, search, rememberScroll } = useRecipeList();
  const cooking = useCookingSession();
  return (
    <ListScreen
      state={state}
      onOpen={(href) => {
        rememberScroll();
        onOpen(href);
      }}
      onRetry={retry}
      status={status.label}
      search={search}
      resume={
        cooking.resume
          ? {
              title: cooking.resume.title,
              onOpen: () => onOpen(cooking.resume ? cooking.resume.href : "/"),
            }
          : undefined
      }
    />
  );
}

function RecipeRoute({
  id,
  onBack,
  onOpen,
}: {
  id: string;
  onBack: () => void;
  onOpen: (href: string) => void;
}) {
  const { state, retry, status, editor } = useRecipe(id);
  const cooking = useCookingSession();
  return (
    <RecipeScreen
      state={state}
      editing={editor.editing}
      draft={editor.draft}
      baseline={editor.baseline}
      formStatus={editor.status}
      onBack={onBack}
      onRetry={retry}
      status={status.label}
      onEditFacts={editor.open}
      onDraftChange={editor.changeDraft}
      onSaveFacts={(fields) => {
        void editor.save(fields);
      }}
      onCancelFacts={editor.cancel}
      cooking={cookingPanel(id, cooking, onOpen)}
    />
  );
}
