import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { createDetachedSession } from "./kitchen-runtime";
import { useRecipeFactsEditor } from "./useRecipeFactsEditor";
import type { KitchenSession } from "./sync/session";

const KitchenContext = createContext<KitchenSession | null>(null);

export function KitchenProvider({
  children,
  session,
}: {
  children: ReactNode;
  session?: KitchenSession;
}) {
  const [value] = useState(() => session ?? createDetachedSession());
  useEffect(() => {
    void value.start();
    return () => {
      value.stop();
    };
  }, [value]);
  return (
    <KitchenContext.Provider value={value}>{children}</KitchenContext.Provider>
  );
}

function useKitchen(): KitchenSession {
  const session = useContext(KitchenContext);
  if (!session) {
    throw new Error("KitchenProvider is required");
  }
  return session;
}

function useSessionTick(session: KitchenSession): void {
  const [, setTick] = useState(0);
  useEffect(
    () => session.subscribe(() => setTick((value) => value + 1)),
    [session],
  );
}

export function useRecipeList() {
  const session = useKitchen();
  useSessionTick(session);
  return {
    state: session.list(),
    retry: () => {
      void session.refetch();
    },
    status: session.syncStatus(),
  };
}

export function useRecipe(id: string) {
  const session = useKitchen();
  useSessionTick(session);
  useEffect(() => {
    void session.openRecipe(id);
  }, [session, id]);
  const state = session.recipe(id);
  const facts = state.kind === "ready" ? state.recipe.facts : null;
  const editor = useRecipeFactsEditor({
    recipeId: id,
    facts,
    saveFields: (recipeId, fields) => session.saveFields(recipeId, fields),
  });
  return {
    state,
    retry: () => {
      void session.openRecipe(id);
    },
    status: session.syncStatus(),
    editor,
  };
}

export function useSyncStatus() {
  const session = useKitchen();
  useSessionTick(session);
  return session.syncStatus();
}
