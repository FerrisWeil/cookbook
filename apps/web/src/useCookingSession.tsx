import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { createDetachedCooking } from "./cooking/browser";
import type { CookingClient } from "./cooking/client";
import type { CookingSession } from "@cookbook/shared";
import { recipePath } from "./route";

const CookingContext = createContext<CookingClient | null>(null);

export function CookingProvider({
  children,
  client,
}: {
  children: ReactNode;
  client?: CookingClient;
}) {
  const [value] = useState(() => client ?? createDetachedCooking());
  useEffect(() => {
    void value.open();
    return () => {
      value.close();
    };
  }, [value]);
  return <CookingContext.Provider value={value}>{children}</CookingContext.Provider>;
}

function useCooking(): CookingClient {
  const client = useContext(CookingContext);
  if (!client) {
    throw new Error("CookingProvider is required");
  }
  return client;
}

function useCookingTick(client: CookingClient): void {
  const [, setTick] = useState(0);
  useEffect(() => client.subscribe(() => setTick((value) => value + 1)), [client]);
}

export function useCookingSession() {
  const client = useCooking();
  useCookingTick(client);
  const view = client.view();
  return {
    view,
    error: client.error(),
    resume: view
      ? { title: view.snapshot.title, href: recipePath(view.recipeId) }
      : null,
    begin: (recipeId: string) => {
      void client.begin(recipeId);
    },
    end: () => {
      void client.end();
    },
    show: (step: number) => {
      void client.show(step);
    },
    complete: () => {
      void client.completeDisplayed();
    },
    undo: () => {
      void client.undoDisplayed();
    },
  };
}

export type CookingPanel =
  | {
      mode: "idle";
      error: string | null;
      onStart: () => void;
    }
  | {
      mode: "elsewhere";
      title: string;
      error: string | null;
      onOpen: () => void;
    }
  | {
      mode: "here";
      session: CookingSession;
      error: string | null;
      onShow: (step: number) => void;
      onComplete: () => void;
      onUndo: () => void;
      onFinish: () => void;
    };

export function cookingPanel(
  recipeId: string,
  cooking: ReturnType<typeof useCookingSession>,
  onOpen: (href: string) => void,
): CookingPanel {
  if (!cooking.view) {
    return {
      mode: "idle",
      error: cooking.error,
      onStart: () => cooking.begin(recipeId),
    };
  }
  if (cooking.view.recipeId !== recipeId) {
    return {
      mode: "elsewhere",
      title: cooking.view.snapshot.title,
      error: cooking.error,
      onOpen: () => onOpen(recipePath(cooking.view?.recipeId ?? recipeId)),
    };
  }
  return {
    mode: "here",
    session: cooking.view,
    error: cooking.error,
    onShow: cooking.show,
    onComplete: cooking.complete,
    onUndo: cooking.undo,
    onFinish: cooking.end,
  };
}
