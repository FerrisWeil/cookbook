import {
  QUERY_LIMITS,
  RECIPE_EFFORTS,
  RECIPE_MEAL_TYPES,
  criteriaIsEmpty,
  displayShortTitle,
  isUnsetPrimaryProtein,
  type ListCriteria,
  type RecipeFacts as RecipeFactsModel,
} from "@cookbook/shared";
import type { RecipeListItem } from "@cookbook/shared";
import { Button, Card, Message, SkeletonCard } from "@cookbook/ui";
import { useEffect, useId, useRef, useState, type RefObject } from "react";

import { LIST_ERROR } from "./api";
import {
  factsAccessibleSummary,
  formatMealType,
  formatTotalMinutes,
} from "./facts";
import { RecipeFacts } from "./RecipeFacts";
import { recipePath } from "./route";

export const NO_MATCHES = "No recipes match.";
export const UPDATING = "Updating recipes.";
const QUICK_MINUTE_PRESETS = [15, 30, 45, 60] as const;

function useIsDesktopFilters(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const media = window.matchMedia("(min-width: 60rem)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

export type ListState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; recipes: RecipeListItem[]; updating?: boolean };

export type ActiveFilterChip = {
  id: string;
  label: string;
};

export type ListSearchProps = {
  title: string;
  onTitleChange: (value: string) => void;
  filtersOpen: boolean;
  onOpenFilters: () => void;
  onCloseFilters: () => void;
  onClearAll: () => void;
  activeFilters: ActiveFilterChip[];
  onRemoveFilter: (id: string) => void;
  criteria: ListCriteria;
  onChangeCriteria: (next: ListCriteria) => void;
  proteinChoices: string[];
  customProtein: string;
  onCustomProteinChange: (value: string) => void;
  onAddCustomProtein: () => void;
  onAddIngredient: (value: string) => void;
};

export function ListScreen({
  state,
  onOpen,
  onOpenSettings,
  onRetry,
  status,
  resume,
  search,
}: {
  state: ListState;
  onOpen: (href: string) => void;
  onOpenSettings?: () => void;
  onRetry: () => void;
  status?: string;
  resume?: { title: string; runningTimers?: number; onOpen: () => void };
  search?: ListSearchProps;
}) {
  const hasCriteria = search ? !criteriaIsEmpty(search.criteria) : false;
  const ready = state.kind === "ready";
  const updating = ready && state.updating === true;
  const emptyLibrary =
    ready && !updating && state.recipes.length === 0 && !hasCriteria;
  const noMatches =
    ready && !updating && state.recipes.length === 0 && hasCriteria;
  const settledCount =
    ready && !updating ? state.recipes.length : null;
  const filtersRef = useRef<HTMLButtonElement>(null);
  const isDesktop = useIsDesktopFilters();

  return (
    <main className="ui-shell">
      <div className="list-discovery-bar">
        <header className="list-header">
          <div className="list-header-title">
            <h1>Recipes</h1>
            {settledCount !== null ? (
              <span className="list-count">
                {settledCount === 1 ? "1 recipe" : `${settledCount} recipes`}
              </span>
            ) : null}
          </div>
          <div className="list-header-actions">
            {resume ? (
              <div className="cooking-resume">
                <Button variant="primary" onClick={resume.onOpen}>
                  {resume.runningTimers && resume.runningTimers > 0
                    ? `Cooking ${resume.title} (${resume.runningTimers} timer${resume.runningTimers === 1 ? "" : "s"} running)`
                    : `Cooking ${resume.title}`}
                </Button>
              </div>
            ) : null}
            {onOpenSettings ? (
              <Button
                variant="tonal"
                className="list-settings-btn"
                onClick={onOpenSettings}
              >
                <SettingsIcon />
                <span>Settings</span>
              </Button>
            ) : null}
          </div>
        </header>
        {status ? (
          <p className="sync-status" role="status">
            {status}
          </p>
        ) : null}
        <ListSearchControls search={search} filtersRef={filtersRef} />
      </div>
      <div
        className={`list-content-layout${search?.filtersOpen ? " has-filters-open" : ""}`}
      >
        <div className="list-results">
          {updating ? (
            <p className="list-updating" role="status">
              {UPDATING}
            </p>
          ) : null}
          <p className="visually-hidden" aria-live="polite" aria-atomic="true">
            {settledCount === null
              ? ""
              : settledCount === 1
                ? "1 recipe."
                : `${settledCount} recipes.`}
          </p>
          {state.kind === "loading" ? <LoadingList /> : null}
          {state.kind === "error" ? (
            <Message>
              <p>{state.message || LIST_ERROR}</p>
              <Button variant="primary" onClick={onRetry}>
                Try again
              </Button>
            </Message>
          ) : null}
          {emptyLibrary ? <Message tone="info">No recipes yet.</Message> : null}
          {noMatches ? (
            <Message tone="info">
              <p>{NO_MATCHES}</p>
              {search && search.activeFilters.length > 0 ? (
                <ul className="list-active-filters">
                  {search.activeFilters.map((filter) => (
                    <li key={filter.id}>
                      <Button
                        variant="tonal"
                        onClick={() => search.onRemoveFilter(filter.id)}
                        aria-label={`Remove ${filter.label}`}
                      >
                        {`${filter.label} ×`}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {search ? (
                <Button variant="primary" onClick={search.onClearAll}>
                  Clear all
                </Button>
              ) : null}
            </Message>
          ) : null}
          {ready && state.recipes.length > 0 ? (
            <ul
              className="recipe-grid"
              aria-busy={updating ? "true" : undefined}
              aria-label={updating ? "Updating recipes" : "Recipes"}
            >
              {state.recipes.map((recipe) => (
                <li key={recipe.id}>
                  <Card
                    href={recipePath(recipe.id)}
                    title={displayShortTitle(recipe)}
                    imageSrc={recipe.imageUrl ?? undefined}
                    imageAlt=""
                    mediaFallback={
                      recipe.imageUrl ? undefined : (
                        <VesselFallbackArt recipe={recipe} />
                      )
                    }
                    badges={<CardOverlayBadges facts={recipe.facts} />}
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
        </div>
        {search ? (
          <ListFiltersDialog
            search={search}
            isDesktop={isDesktop}
            filtersRef={filtersRef}
          />
        ) : null}
      </div>
    </main>
  );
}

function ListSearchControls({
  search,
  filtersRef,
}: {
  search?: ListSearchProps;
  filtersRef: RefObject<HTMLButtonElement | null>;
}) {
  const titleId = useId();

  if (!search) {
    return (
      <div className="list-toolbar">
        <div className="list-search">
          <label htmlFor={titleId}>Recipe name</label>
          <input
            id={titleId}
            type="search"
            enterKeyHint="search"
            placeholder="Search titles, ingredients, or proteins…"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={QUERY_LIMITS.maxPhraseLength}
            value=""
            onChange={() => {}}
          />
        </div>
        <Button variant="tonal" aria-expanded={false}>
          Filters
        </Button>
      </div>
    );
  }

  const allMealsEmpty =
    search.criteria.mealTypes.length === 0 &&
    search.criteria.maxTotalMinutes === null;
  const quick30 = search.criteria.maxTotalMinutes === 30;

  return (
    <div className="list-toolbar">
      <div className="list-toolbar-main">
        <div className="list-search">
          <label htmlFor={titleId}>Recipe name</label>
          <input
            id={titleId}
            type="search"
            enterKeyHint="search"
            placeholder="Search titles, ingredients, or proteins…"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={QUERY_LIMITS.maxPhraseLength}
            value={search.title}
            onChange={(event) => search.onTitleChange(event.target.value)}
          />
        </div>
        <Button
          ref={filtersRef}
          variant={search.filtersOpen ? "primary" : "tonal"}
          aria-expanded={search.filtersOpen}
          aria-haspopup="dialog"
          onClick={() =>
            search.filtersOpen ? search.onCloseFilters() : search.onOpenFilters()
          }
        >
          {search.activeFilters.length > 0
            ? `Filters (${search.activeFilters.length})`
            : "Filters"}
        </Button>
        {search.activeFilters.length > 0 || search.title.trim() !== "" ? (
          <Button variant="quiet" onClick={search.onClearAll}>
            Clear all
          </Button>
        ) : null}
      </div>

      <div className="list-quick-tabs" role="group" aria-label="Menu quick categories">
        <button
          type="button"
          className={`list-quick-tab${allMealsEmpty ? " is-active" : ""}`}
          onClick={() =>
            search.onChangeCriteria({
              ...search.criteria,
              mealTypes: [],
              maxTotalMinutes: null,
            })
          }
        >
          All
        </button>
        {RECIPE_MEAL_TYPES.map((meal) => {
          const active =
            search.criteria.mealTypes.length === 1 &&
            search.criteria.mealTypes[0] === meal;
          return (
            <button
              key={meal}
              type="button"
              className={`list-quick-tab${active ? " is-active" : ""}`}
              onClick={() =>
                search.onChangeCriteria({
                  ...search.criteria,
                  mealTypes: active ? [] : [meal],
                })
              }
            >
              {formatMealType(meal)}
            </button>
          );
        })}
        <button
          type="button"
          className={`list-quick-tab${quick30 ? " is-active" : ""}`}
          onClick={() =>
            search.onChangeCriteria({
              ...search.criteria,
              maxTotalMinutes: quick30 ? null : 30,
            })
          }
        >
          Quick ≤ 30m
        </button>
      </div>

      {search.activeFilters.length > 0 ? (
        <ul className="list-active-filters">
          {search.activeFilters.map((filter) => (
            <li key={filter.id}>
              <Button
                variant="tonal"
                onClick={() => search.onRemoveFilter(filter.id)}
                aria-label={`Remove ${filter.label}`}
              >
                {`${filter.label} ×`}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ListFiltersDialog({
  search,
  isDesktop,
  filtersRef,
}: {
  search: ListSearchProps;
  isDesktop: boolean;
  filtersRef: RefObject<HTMLButtonElement | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const ingredientRef = useRef<HTMLInputElement>(null);
  const modalModeRef = useRef<boolean | null>(null);
  const suppressCloseRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (!search.filtersOpen) {
      if (dialog.open) {
        suppressCloseRef.current = true;
        dialog.close();
        suppressCloseRef.current = false;
      }
      modalModeRef.current = null;
      return;
    }

    const wantModal = !isDesktop;
    if (dialog.open && modalModeRef.current !== wantModal) {
      suppressCloseRef.current = true;
      dialog.close();
      suppressCloseRef.current = false;
    }
    if (!dialog.open) {
      if (wantModal) {
        dialog.showModal();
      } else {
        dialog.show();
      }
      modalModeRef.current = wantModal;
    }
  }, [search.filtersOpen, isDesktop]);

  useEffect(() => {
    if (!search.filtersOpen || !isDesktop || typeof window === "undefined") {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        search.onCloseFilters();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [search.filtersOpen, isDesktop, search]);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !search.filtersOpen) {
      filtersRef.current?.focus();
    }
    wasOpen.current = search.filtersOpen;
  }, [search.filtersOpen, filtersRef]);

  const hasAnyFilter =
    search.activeFilters.length > 0 || search.title.trim() !== "";

  return (
    <dialog
      ref={dialogRef}
      className={`list-filters-dialog${isDesktop ? " is-desktop-panel" : ""}`}
      aria-labelledby="list-filters-title"
      onClose={() => {
        if (!suppressCloseRef.current) {
          search.onCloseFilters();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        search.onCloseFilters();
      }}
      onClick={(event) => {
        if (!isDesktop && event.target === dialogRef.current) {
          search.onCloseFilters();
        }
      }}
    >
      <div className="list-filters-panel">
        <div className="list-filters-header">
          <h2 id="list-filters-title">Filters</h2>
          <Button
            variant="quiet"
            className="list-filters-close"
            onClick={search.onCloseFilters}
            aria-label="Close filters"
          >
            ✕
          </Button>
        </div>

        <fieldset className="facts-field list-filter-section">
          <legend>Ingredients</legend>
          {search.criteria.ingredients.length > 0 ? (
            <ul className="list-filter-added" aria-label="Added ingredients">
              {search.criteria.ingredients.map((item, index) => (
                <li key={`${item}-${index}`}>
                  <Button
                    variant="tonal"
                    className="list-filter-added-chip"
                    onClick={() => search.onRemoveFilter(`ingredient:${index}`)}
                    aria-label={`Remove ingredient ${item}`}
                  >
                    {`${item} ×`}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="list-filter-inline-add">
            <label>
              Add ingredient
              <input
                ref={ingredientRef}
                type="text"
                autoComplete="off"
                placeholder="e.g. garlic, miso"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    search.onAddIngredient(event.currentTarget.value);
                    event.currentTarget.value = "";
                  }
                }}
              />
            </label>
            <Button
              variant="tonal"
              onClick={() => {
                const value = ingredientRef.current?.value ?? "";
                search.onAddIngredient(value);
                if (ingredientRef.current) {
                  ingredientRef.current.value = "";
                }
              }}
            >
              Add ingredient
            </Button>
          </div>
        </fieldset>

        <fieldset className="facts-field list-filter-section">
          <legend>Primary protein</legend>
          <div className="filter-pill-grid">
            {search.proteinChoices.map((choice) => {
              const checked = search.criteria.proteins.some(
                (item) => item.toLowerCase() === choice.toLowerCase(),
              );
              return (
                <label
                  key={choice}
                  className={`filter-pill-option${checked ? " is-selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const proteins = checked
                        ? search.criteria.proteins.filter(
                            (item) => item.toLowerCase() !== choice.toLowerCase(),
                          )
                        : [...search.criteria.proteins, choice];
                      search.onChangeCriteria({ ...search.criteria, proteins });
                    }}
                  />
                  <span>{choice}</span>
                </label>
              );
            })}
          </div>
          <div className="list-filter-inline-add">
            <label>
              Custom protein
              <input
                type="text"
                autoComplete="off"
                placeholder="e.g. duck, tempeh"
                value={search.customProtein}
                onChange={(event) =>
                  search.onCustomProteinChange(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    search.onAddCustomProtein();
                  }
                }}
              />
            </label>
            <Button variant="tonal" onClick={search.onAddCustomProtein}>
              Add protein
            </Button>
          </div>
        </fieldset>

        <div className="list-filter-section">
          <label className="facts-field">
            <span>Max total minutes</span>
            <input
              type="number"
              min={0}
              max={10080}
              inputMode="numeric"
              placeholder="Any"
              value={search.criteria.maxTotalMinutes ?? ""}
              onChange={(event) => {
                const raw = event.target.value;
                search.onChangeCriteria({
                  ...search.criteria,
                  maxTotalMinutes:
                    raw.trim() === "" ? null : Number.parseInt(raw, 10),
                });
              }}
            />
          </label>
          <div className="filter-segmented-row" role="group" aria-label="Quick time limits">
            {QUICK_MINUTE_PRESETS.map((minutes) => {
              const active = search.criteria.maxTotalMinutes === minutes;
              return (
                <button
                  key={minutes}
                  type="button"
                  aria-pressed={active}
                  className={`filter-pill-option filter-pill-btn${active ? " is-selected" : ""}`}
                  onClick={() =>
                    search.onChangeCriteria({
                      ...search.criteria,
                      maxTotalMinutes: active ? null : minutes,
                    })
                  }
                >
                  {`≤ ${minutes} min`}
                </button>
              );
            })}
          </div>
        </div>

        <fieldset className="facts-field list-filter-section">
          <legend>Effort</legend>
          <div className="filter-pill-grid filter-segmented-group">
            {RECIPE_EFFORTS.map((effort) => {
              const checked = search.criteria.efforts.includes(effort);
              return (
                <label
                  key={effort}
                  className={`filter-pill-option${checked ? " is-selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const efforts = checked
                        ? search.criteria.efforts.filter((item) => item !== effort)
                        : [...search.criteria.efforts, effort];
                      search.onChangeCriteria({ ...search.criteria, efforts });
                    }}
                  />
                  <span>{effort}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="facts-field list-filter-section">
          <legend>Meal type</legend>
          <div className="filter-pill-grid">
            {RECIPE_MEAL_TYPES.map((meal) => {
              const checked = search.criteria.mealTypes.includes(meal);
              return (
                <label
                  key={meal}
                  className={`filter-pill-option${checked ? " is-selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const mealTypes = checked
                        ? search.criteria.mealTypes.filter((item) => item !== meal)
                        : [...search.criteria.mealTypes, meal];
                      search.onChangeCriteria({ ...search.criteria, mealTypes });
                    }}
                  />
                  <span>{meal}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="list-filters-footer">
          {hasAnyFilter ? (
            <Button variant="quiet" onClick={search.onClearAll}>
              Clear all
            </Button>
          ) : null}
          <Button variant="primary" onClick={search.onCloseFilters}>
            Done
          </Button>
        </div>
      </div>
    </dialog>
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

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .68.4 1.3 1.02 1.58.3.13.62.2.98.2H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function CardOverlayBadges({ facts }: { facts: RecipeFactsModel }) {
  const minutes = facts.totalMinutes;
  const specifiedProtein = isUnsetPrimaryProtein(facts.primaryProtein)
    ? null
    : facts.primaryProtein;
  const rightLabel =
    specifiedProtein ??
    (facts.mealTypes[0] ? formatMealType(facts.mealTypes[0]) : null);

  if (minutes === null && !rightLabel) {
    return null;
  }

  return (
    <>
      {minutes !== null ? (
        <span className="ui-card-pill ui-card-pill--time" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span>{formatTotalMinutes(minutes)}</span>
        </span>
      ) : (
        <span />
      )}
      {rightLabel ? (
        <span className="ui-card-pill ui-card-pill--tag" aria-hidden="true">
          {rightLabel}
        </span>
      ) : null}
    </>
  );
}

type VesselKind = "pot" | "skillet" | "bowl" | "bake" | "plate";

function inferVesselKind(recipe: RecipeListItem): VesselKind {
  const lower = `${recipe.id} ${recipe.title}`.toLowerCase();
  if (/stew|soup|braise|poach|mole/.test(lower)) {
    return "pot";
  }
  if (/skillet|chops|shrimp/.test(lower)) {
    return "skillet";
  }
  if (/bowl|oats|farro|salad|chickpeas/.test(lower)) {
    return "bowl";
  }
  if (/galette|tart|cheesecake|skewers|parcels/.test(lower)) {
    return "bake";
  }
  return "plate";
}

function VesselFallbackArt({ recipe }: { recipe: RecipeListItem }) {
  const kind = inferVesselKind(recipe);
  const labelMap: Record<VesselKind, string> = {
    pot: "Simmer pot",
    skillet: "Skillet dish",
    bowl: "Bowl meal",
    bake: "Roasted & baked",
    plate: "Plated dinner",
  };
  return (
    <span className={`vessel-fallback vessel-fallback--${kind}`} aria-hidden="true">
      <svg viewBox="0 0 120 76" className="vessel-fallback-svg">
        {kind === "pot" ? (
          <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M35 32h50v21a10 10 0 0 1-10 10H45a10 10 0 0 1-10-10V32Z" />
            <path d="M29 36h6M85 36h6" />
            <path d="M33 32h54" />
            <path d="M51 22c0-4 3-5 3-9M60 20c0-4 3-5 3-9M69 22c0-4 3-5 3-9" opacity="0.7" />
          </g>
        ) : kind === "skillet" ? (
          <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="52" cy="41" rx="24" ry="12" />
            <path d="M28 41v6c0 6.5 10.7 12 24 12s24-5.5 24-12v-6" />
            <path d="M76 41l22-6" strokeWidth="3" />
          </g>
        ) : kind === "bowl" ? (
          <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="60" cy="34" rx="25" ry="8" />
            <path d="M35 34c1 17 11 26 25 26s24-9 25-26" />
            <path d="M48 60h24" />
          </g>
        ) : kind === "bake" ? (
          <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="32" y="29" width="56" height="28" rx="6" />
            <path d="M27 36h5M88 36h5" />
            <path d="M44 43h32" opacity="0.65" />
          </g>
        ) : (
          <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="60" cy="41" rx="28" ry="15" />
            <ellipse cx="60" cy="41" rx="17" ry="8.5" opacity="0.65" />
          </g>
        )}
      </svg>
      <span className="vessel-fallback-caption">{labelMap[kind]}</span>
    </span>
  );
}
