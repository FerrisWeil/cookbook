import {
  MAX_TOTAL_MINUTES,
  QUERY_LIMITS,
  compileListCriteria,
  criteriaIsEmpty,
  emptyListCriteria,
  listCriteriaFromSearch,
  listSearchFromCriteria,
  normalizePhrase,
  type ListCriteria,
} from "@cookbook/shared";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { ActiveFilterChip } from "./ListScreen";
import { createDetachedSession } from "./kitchen-runtime";
import { listScrollFromState, rememberListPosition } from "./navigate";
import { useRecipeFactsEditor } from "./useRecipeFactsEditor";
import type { KitchenSession } from "./sync/session";

export const TITLE_DEBOUNCE_MS = 300;

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

function currentSearch(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.search;
}

function listHref(criteria: ListCriteria): string {
  const search = listSearchFromCriteria(criteria);
  return search === "" ? "/" : `/${search}`;
}

function writeListUrl(criteria: ListCriteria, mode: "push" | "replace"): void {
  if (typeof window === "undefined") {
    return;
  }
  const next = listHref(criteria);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === next) {
    return;
  }
  const state = { cookbook: true, scroll: window.scrollY };
  if (mode === "push") {
    window.history.pushState(state, "", next);
  } else {
    window.history.replaceState(state, "", next);
  }
}

export function activeFiltersFrom(criteria: ListCriteria): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  const title = criteria.title.trim().replace(/ +/g, " ");
  if (title !== "") {
    chips.push({ id: "title", label: `Name: ${title}` });
  }
  criteria.ingredients.forEach((item, index) => {
    chips.push({ id: `ingredient:${index}`, label: item });
  });
  criteria.proteins.forEach((item, index) => {
    chips.push({ id: `protein:${index}`, label: item });
  });
  if (criteria.maxTotalMinutes !== null) {
    chips.push({
      id: "maxMinutes",
      label: `Up to ${criteria.maxTotalMinutes} min`,
    });
  }
  criteria.efforts.forEach((item) => {
    chips.push({ id: `effort:${item}`, label: item });
  });
  criteria.mealTypes.forEach((item) => {
    chips.push({ id: `meal:${item}`, label: item });
  });
  return chips;
}

function removeFilter(criteria: ListCriteria, id: string): ListCriteria {
  if (id === "title") {
    return { ...criteria, title: "" };
  }
  if (id === "maxMinutes") {
    return { ...criteria, maxTotalMinutes: null };
  }
  if (id.startsWith("ingredient:")) {
    const index = Number(id.slice("ingredient:".length));
    return {
      ...criteria,
      ingredients: criteria.ingredients.filter((_, item) => item !== index),
    };
  }
  if (id.startsWith("protein:")) {
    const index = Number(id.slice("protein:".length));
    return {
      ...criteria,
      proteins: criteria.proteins.filter((_, item) => item !== index),
    };
  }
  if (id.startsWith("effort:")) {
    const value = id.slice("effort:".length);
    return {
      ...criteria,
      efforts: criteria.efforts.filter((item) => item !== value),
    };
  }
  if (id.startsWith("meal:")) {
    const value = id.slice("meal:".length);
    return {
      ...criteria,
      mealTypes: criteria.mealTypes.filter((item) => item !== value),
    };
  }
  return criteria;
}

export function useRecipeList() {
  const session = useKitchen();
  useSessionTick(session);
  const [criteria, setCriteria] = useState(() =>
    listCriteriaFromSearch(currentSearch()),
  );
  const [titleDraft, setTitleDraft] = useState(criteria.title);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [customProtein, setCustomProtein] = useState("");
  const titleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const startScroll = listScrollFromState(window.history.state);
    if (startScroll !== undefined) {
      window.scrollTo(0, startScroll);
    }
    function onPop() {
      if (titleTimer.current) {
        clearTimeout(titleTimer.current);
        titleTimer.current = undefined;
      }
      const next = listCriteriaFromSearch(window.location.search);
      setCriteria(next);
      setTitleDraft(next.title);
      const historyScroll = listScrollFromState(window.history.state);
      if (historyScroll !== undefined) {
        window.scrollTo(0, historyScroll);
      }
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    void session.setListQuery(compileListCriteria(criteria));
  }, [criteria, session]);

  function cancelTitleTimer(): void {
    if (titleTimer.current) {
      clearTimeout(titleTimer.current);
      titleTimer.current = undefined;
    }
  }

  function boundedPhrase(value: string): string {
    return value.trim().replace(/ +/g, " ").slice(0, QUERY_LIMITS.maxPhraseLength);
  }

  function commitTitle(value: string, mode: "push" | "replace"): void {
    setCriteria((current) => {
      const next = { ...current, title: boundedPhrase(value) };
      writeListUrl(next, mode);
      return next;
    });
  }

  function applyCriteria(next: ListCriteria, mode: "push" | "replace" = "push"): void {
    cancelTitleTimer();
    let maxTotalMinutes = next.maxTotalMinutes;
    if (
      maxTotalMinutes === null ||
      !Number.isInteger(maxTotalMinutes) ||
      maxTotalMinutes < 0
    ) {
      maxTotalMinutes = null;
    } else if (maxTotalMinutes > MAX_TOTAL_MINUTES) {
      maxTotalMinutes = MAX_TOTAL_MINUTES;
    }
    const cleaned: ListCriteria = {
      ...next,
      title: boundedPhrase(next.title),
      ingredients: next.ingredients
        .map((item) => boundedPhrase(item))
        .filter((item) => item !== ""),
      proteins: next.proteins
        .map((item) => boundedPhrase(item))
        .filter((item) => item !== ""),
      maxTotalMinutes,
    };
    setCriteria(cleaned);
    setTitleDraft(cleaned.title);
    writeListUrl(cleaned, mode);
  }

  return {
    state: session.list(),
    retry: () => {
      void session.refetch();
    },
    status: session.syncStatus(),
    proteinChoices: session.proteinChoices(),
    search: {
      title: titleDraft,
      onTitleChange(value: string) {
        setTitleDraft(value);
        if (titleTimer.current) {
          clearTimeout(titleTimer.current);
        }
        titleTimer.current = setTimeout(() => {
          commitTitle(value, "replace");
        }, TITLE_DEBOUNCE_MS);
      },
      filtersOpen,
      onOpenFilters() {
        setFiltersOpen(true);
      },
      onCloseFilters() {
        setFiltersOpen(false);
      },
      onClearAll() {
        applyCriteria(emptyListCriteria(), "push");
      },
      activeFilters: activeFiltersFrom(criteria),
      onRemoveFilter(id: string) {
        applyCriteria(removeFilter({ ...criteria, title: titleDraft }, id), "push");
      },
      criteria,
      onChangeCriteria(next: ListCriteria) {
        applyCriteria({ ...next, title: titleDraft }, "push");
      },
      proteinChoices: session.proteinChoices(),
      customProtein,
      onCustomProteinChange: setCustomProtein,
      onAddCustomProtein() {
        const phrase = normalizePhrase(customProtein);
        if (phrase === null) {
          return;
        }
        const display = customProtein.trim().replace(/ +/g, " ");
        if (
          criteria.proteins.some((item) => item.toLowerCase() === display.toLowerCase())
        ) {
          setCustomProtein("");
          return;
        }
        applyCriteria(
          {
            ...criteria,
            title: titleDraft,
            proteins: [...criteria.proteins, display],
          },
          "push",
        );
        setCustomProtein("");
      },
      onAddIngredient(value: string) {
        const display = value.trim().replace(/ +/g, " ");
        if (display === "") {
          return;
        }
        applyCriteria(
          {
            ...criteria,
            title: titleDraft,
            ingredients: [...criteria.ingredients, display],
          },
          "push",
        );
      },
    },
    hasCriteria: !criteriaIsEmpty(criteria),
    rememberScroll() {
      if (typeof window === "undefined") {
        return;
      }
      if (titleTimer.current) {
        clearTimeout(titleTimer.current);
        titleTimer.current = undefined;
        commitTitle(titleDraft, "replace");
      }
      rememberListPosition(
        window.history,
        `${window.location.pathname}${window.location.search}`,
        window.scrollY,
      );
    },
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
