import {
  RECIPE_EFFORTS,
  RECIPE_MEAL_TYPES,
  criteriaIsEmpty,
  type ListCriteria,
} from "@cookbook/shared";
import type { RecipeListItem } from "@cookbook/shared";
import { Button, Card, Message, SkeletonCard } from "@cookbook/ui";
import { useEffect, useId, useRef } from "react";

import { LIST_ERROR } from "./api";
import { factsAccessibleSummary } from "./facts";
import { RecipeFacts } from "./RecipeFacts";
import { recipePath } from "./route";

export const NO_MATCHES = "No recipes match.";
export const UPDATING = "Updating recipes.";

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
  onRetry,
  status,
  resume,
  search,
}: {
  state: ListState;
  onOpen: (href: string) => void;
  onRetry: () => void;
  status?: string;
  resume?: { title: string; onOpen: () => void };
  search?: ListSearchProps;
}) {
  const hasCriteria = search ? !criteriaIsEmpty(search.criteria) : false;
  const ready = state.kind === "ready";
  const updating = ready && state.updating === true;
  const emptyLibrary = ready && state.recipes.length === 0 && !hasCriteria;
  const noMatches = ready && state.recipes.length === 0 && hasCriteria;
  const settledCount =
    ready && !updating ? state.recipes.length : null;

  return (
    <main className="ui-shell">
      <h1>Recipes</h1>
      {status ? (
        <p className="sync-status" role="status">
          {status}
        </p>
      ) : null}
      {resume ? (
        <p className="cooking-resume">
          <Button variant="primary" onClick={resume.onOpen}>
            {`Cooking ${resume.title}`}
          </Button>
        </p>
      ) : null}
      <ListSearchControls search={search} />
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

function ListSearchControls({ search }: { search?: ListSearchProps }) {
  const titleId = useId();
  const filtersRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const ingredientRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !search) {
      return;
    }
    if (search.filtersOpen && !dialog.open) {
      dialog.showModal();
    }
    if (!search.filtersOpen && dialog.open) {
      dialog.close();
    }
  }, [search]);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && search && !search.filtersOpen) {
      filtersRef.current?.focus();
    }
    wasOpen.current = search?.filtersOpen === true;
  }, [search, search?.filtersOpen]);

  if (!search) {
    return (
      <div className="list-toolbar">
        <div className="list-search">
          <label htmlFor={titleId}>Recipe name</label>
          <input
            id={titleId}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
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

  return (
    <div className="list-toolbar">
      <div className="list-search">
        <label htmlFor={titleId}>Recipe name</label>
        <input
          id={titleId}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={search.title}
          onChange={(event) => search.onTitleChange(event.target.value)}
        />
      </div>
      <Button
        ref={filtersRef}
        variant="tonal"
        aria-expanded={search.filtersOpen}
        aria-haspopup="dialog"
        onClick={search.onOpenFilters}
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
      <dialog
        ref={dialogRef}
        className="list-filters-dialog"
        aria-labelledby="list-filters-title"
        onClose={search.onCloseFilters}
        onCancel={search.onCloseFilters}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            search.onCloseFilters();
          }
        }}
      >
        <div className="list-filters-panel">
          <h2 id="list-filters-title">Filters</h2>
          <fieldset className="facts-field">
            <legend>Ingredients</legend>
            {search.criteria.ingredients.map((item) => (
              <p key={item}>{item}</p>
            ))}
            <label>
              Add ingredient
              <input
                ref={ingredientRef}
                type="text"
                autoComplete="off"
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
          </fieldset>
          <fieldset className="facts-field">
            <legend>Primary protein</legend>
            {search.proteinChoices.map((choice) => {
              const checked = search.criteria.proteins.some(
                (item) => item.toLowerCase() === choice.toLowerCase(),
              );
              return (
                <label key={choice}>
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
                  {choice}
                </label>
              );
            })}
            <label>
              Custom protein
              <input
                type="text"
                autoComplete="off"
                value={search.customProtein}
                onChange={(event) =>
                  search.onCustomProteinChange(event.target.value)
                }
              />
            </label>
            <Button variant="tonal" onClick={search.onAddCustomProtein}>
              Add protein
            </Button>
          </fieldset>
          <label className="facts-field">
            Max total minutes
            <input
              type="number"
              min={0}
              max={10080}
              inputMode="numeric"
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
          <fieldset className="facts-field">
            <legend>Effort</legend>
            {RECIPE_EFFORTS.map((effort) => (
              <label key={effort}>
                <input
                  type="checkbox"
                  checked={search.criteria.efforts.includes(effort)}
                  onChange={() => {
                    const efforts = search.criteria.efforts.includes(effort)
                      ? search.criteria.efforts.filter((item) => item !== effort)
                      : [...search.criteria.efforts, effort];
                    search.onChangeCriteria({ ...search.criteria, efforts });
                  }}
                />
                {effort}
              </label>
            ))}
          </fieldset>
          <fieldset className="facts-field">
            <legend>Meal type</legend>
            {RECIPE_MEAL_TYPES.map((meal) => (
              <label key={meal}>
                <input
                  type="checkbox"
                  checked={search.criteria.mealTypes.includes(meal)}
                  onChange={() => {
                    const mealTypes = search.criteria.mealTypes.includes(meal)
                      ? search.criteria.mealTypes.filter((item) => item !== meal)
                      : [...search.criteria.mealTypes, meal];
                    search.onChangeCriteria({ ...search.criteria, mealTypes });
                  }}
                />
                {meal}
              </label>
            ))}
          </fieldset>
          <Button variant="primary" onClick={search.onCloseFilters}>
            Done
          </Button>
        </div>
      </dialog>
    </div>
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
