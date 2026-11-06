import { Message } from "@cookbook/ui";
import { useEffect, useState } from "react";

import {
  fetchRecipeList,
  fetchRecipeView,
  LIST_ERROR,
  RECIPE_ERROR,
  RECIPE_MISSING,
} from "./api";
import { ListScreen, type ListState } from "./ListScreen";
import { leaveRecipe, pushAppPath } from "./navigate";
import { parseRoute } from "./route";
import { RecipeScreen, type RecipeState } from "./RecipeScreen";

export function App({ initialPath }: { initialPath?: string } = {}) {
  const [path, setPath] = useState(
    () => initialPath ?? currentPath(),
  );

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
    return (
      <RecipeRoute
        id={route.id}
        onBack={backToList}
      />
    );
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
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    fetchRecipeList(controller.signal)
      .then((recipes) => {
        if (!controller.signal.aborted) {
          setState({ kind: "ready", recipes });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : LIST_ERROR;
        setState({ kind: "error", message });
      });
    return () => controller.abort();
  }, [nonce]);

  return (
    <ListScreen
      state={state}
      onOpen={onOpen}
      onRetry={() => setNonce((value) => value + 1)}
    />
  );
}

function RecipeRoute({ id, onBack }: { id: string; onBack: () => void }) {
  const [state, setState] = useState<RecipeState>({ kind: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    fetchRecipeView(id, controller.signal)
      .then((recipe) => {
        if (!controller.signal.aborted) {
          setState({ kind: "ready", recipe });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : RECIPE_ERROR;
        setState(
          message === RECIPE_MISSING
            ? { kind: "missing" }
            : { kind: "error", message },
        );
      });
    return () => controller.abort();
  }, [id, nonce]);

  return (
    <RecipeScreen
      state={state}
      onBack={onBack}
      onRetry={() => setNonce((value) => value + 1)}
    />
  );
}
