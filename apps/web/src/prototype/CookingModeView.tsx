import { Button, Message } from "@cookbook/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { primeTimerAudio, usePreferences } from "../settings/preferences";
import {
  formatTimerClockValue,
  formatTimerSeconds,
  type PrototypeCookingClient,
  type PrototypeCookingExtras,
} from "./cookingStore";
import { resolvePantryIngredientAsset } from "./pantryCatalog";
import { useTimersDrawer } from "./TimersDrawer";

export function CookingModeView({
  client,
  extras,
  displayedStep,
  completedSteps,
  error,
  onBack,
  onShow,
  onFinish,
}: {
  client: PrototypeCookingClient;
  extras: PrototypeCookingExtras;
  displayedStep: number;
  completedSteps: number[];
  error: string | null;
  onBack: () => void;
  onShow: (step: number) => void;
  onFinish: () => void;
}) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const stickyDockRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Array<HTMLLIElement | null>>([]);
  const pendingScrollStepRef = useRef<number | null>(null);
  const { cooking: cookingPrefs } = usePreferences();
  const timersDrawer = useTimersDrawer();
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(
    () => new Set(),
  );

  const completedSet = new Set(completedSteps);
  const completedCount = completedSteps.length;
  const totalSteps = extras.steps.length;
  const progressPercent =
    totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const checkedIngSet = new Set(extras.checkedIngredients);
  const checkedStepIngSet = new Set(extras.checkedStepIngredients);
  const currentStepCompleted = completedSet.has(displayedStep);

  const syncStickyOffset = useCallback(() => {
    const workspace = workspaceRef.current;
    const dock = stickyDockRef.current;
    if (!workspace || !dock) {
      return;
    }
    const height = Math.ceil(dock.getBoundingClientRect().height);
    if (height > 0) {
      workspace.style.setProperty("--cooking-sticky-offset", `${height + 20}px`);
    }
  }, []);

  useEffect(() => {
    syncStickyOffset();
    const dock = stickyDockRef.current;
    if (!dock || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => syncStickyOffset());
    observer.observe(dock);
    return () => observer.disconnect();
  }, [extras.timers.length, syncStickyOffset]);

  const scrollStepToTop = useCallback(
    (index: number) => {
      syncStickyOffset();
      const node = stepRefs.current[index];
      if (node && typeof node.scrollIntoView === "function") {
        const reduced =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        node.scrollIntoView({
          behavior: reduced ? "auto" : "smooth",
          block: "start",
        });
      }
    },
    [syncStickyOffset],
  );

  useEffect(() => {
    if (pendingScrollStepRef.current === displayedStep) {
      pendingScrollStepRef.current = null;
      scrollStepToTop(displayedStep);
    }
  }, [displayedStep, scrollStepToTop]);

  function focusAndScrollToStep(index: number) {
    if (index < 0 || index >= totalSteps) {
      return;
    }
    if (index === displayedStep) {
      scrollStepToTop(index);
      return;
    }
    pendingScrollStepRef.current = index;
    onShow(index);
  }

  function expandStep(index: number) {
    setExpandedSteps((prev) => {
      if (prev.has(index)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }

  function collapseStep(index: number) {
    setExpandedSteps((prev) => {
      if (!prev.has(index)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }

  function handleToggleStep(index: number) {
    const wasCompleted = completedSet.has(index);
    client.toggleStepCompleted(index);
    collapseStep(index);
    if (!wasCompleted && index === displayedStep && cookingPrefs.autoAdvanceStep) {
      const nextSet = new Set([...completedSteps, index]);
      const nextIncomplete = extras.steps.findIndex(
        (_, candidate) => candidate > index && !nextSet.has(candidate),
      );
      if (nextIncomplete !== -1) {
        pendingScrollStepRef.current = nextIncomplete;
        onShow(nextIncomplete);
      }
    }
  }

  return (
    <div ref={workspaceRef} className="cooking-workspace">
      <div className="cooking-topbar">
        <div className="cooking-topbar-nav">
          <Button className="ui-back" variant="tonal" onClick={onBack}>
            Back
          </Button>
          <p className="cooking-session-meta" role="status">
            {`${completedCount} of ${totalSteps} steps done · Saved in this browser`}
          </p>
        </div>
      </div>

      <div className="cooking-hero">
        <h1 className="cooking-title">{extras.recipeTitle}</h1>
      </div>
      {error ? <Message>{error}</Message> : null}

      <div ref={stickyDockRef} className="cooking-sticky-dock">
        <div
          className="cooking-control-bar"
          role="region"
          aria-label="Cooking controls"
        >
          <div className="cooking-control-progress">
            <span className="cooking-control-step-label">
              {`Step ${displayedStep + 1} of ${totalSteps}`}
            </span>
            <div className="cooking-progress" aria-hidden="true">
              <div className="cooking-progress-track">
                <div
                  className="cooking-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="cooking-progress-label">
                {`${completedCount}/${totalSteps}`}
              </span>
            </div>
          </div>

          <div className="cooking-control-actions">
            <Button
              variant="tonal"
              onClick={() => focusAndScrollToStep(Math.max(0, displayedStep - 1))}
              disabled={displayedStep === 0}
            >
              Previous step
            </Button>
            <Button
              variant={currentStepCompleted ? "tonal" : "primary"}
              className="cooking-control-complete-btn"
              onClick={() => handleToggleStep(displayedStep)}
            >
              {currentStepCompleted
                ? "Undo step"
                : displayedStep < totalSteps - 1
                  ? "Done · Next step"
                  : "Mark step done"}
            </Button>
            <Button
              variant="tonal"
              onClick={() =>
                focusAndScrollToStep(Math.min(totalSteps - 1, displayedStep + 1))
              }
              disabled={displayedStep >= totalSteps - 1}
            >
              Next step
            </Button>
            <Button
              variant={extras.timers.length > 0 ? "tonal" : "quiet"}
              className="cooking-control-timers-btn"
              aria-expanded={timersDrawer.open}
              onClick={timersDrawer.toggle}
            >
              {`Timers (${extras.timers.length})`}
            </Button>
            <Button
              variant="danger"
              className="cooking-control-end-btn"
              onClick={onFinish}
            >
              End cooking session
            </Button>
          </div>
        </div>
      </div>

      <div className="cooking-columns">
        <aside className="cooking-ingredients-panel" aria-label="Full ingredient list">
          <div className="cooking-panel-heading">
            <h2>Ingredients</h2>
            <span className="cooking-panel-count">
              {`${checkedIngSet.size}/${extras.fullIngredients.length} gathered`}
            </span>
          </div>
          {checkedIngSet.size > 0 || checkedStepIngSet.size > 0 ? (
            <Button
              variant="quiet"
              className="cooking-clear-checks"
              onClick={() => client.clearIngredients()}
            >
              Uncheck all ingredients
            </Button>
          ) : null}
          <ul className="cooking-ingredient-checklist">
            {extras.fullIngredients.map((line, index) => {
              const checked = checkedIngSet.has(index);
              const imageSrc = extras.ingredientImages?.[index];
              return (
                <li key={index}>
                  <label
                    className={`cooking-check-row${checked ? " is-checked" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => client.toggleIngredient(index)}
                    />
                    <span className="cooking-check-box" aria-hidden="true">
                      {checked ? <CheckMarkIcon /> : null}
                    </span>
                    {imageSrc ? (
                      <span className="ingredient-thumb-wrap" aria-hidden="true">
                        <img
                          className="ingredient-thumb"
                          src={imageSrc}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      </span>
                    ) : null}
                    <span className="cooking-check-label">{line}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="cooking-steps-panel" aria-label="Cooking steps">
          <div className="cooking-panel-heading">
            <h2>Steps</h2>
            <span className="cooking-panel-count">
              {`Step ${displayedStep + 1} of ${totalSteps}`}
            </span>
          </div>
          <ol className="cooking-step-cards">
            {extras.steps.map((step, index) => {
              const isCompleted = completedSet.has(index);
              const isCurrent = displayedStep === index;
              const isExpanded = expandedSteps.has(index);
              const isCollapsed =
                cookingPrefs.autoCollapseCompletedSteps &&
                isCompleted &&
                !isCurrent &&
                !isExpanded;

              if (isCollapsed) {
                return (
                  <li
                    key={index}
                    ref={(node) => {
                      stepRefs.current[index] = node;
                    }}
                    className="cooking-step-card cooking-step-card--completed cooking-step-card--collapsed"
                  >
                    <div className="cooking-step-collapsed-row">
                      <span
                        className="cooking-step-collapsed-check"
                        aria-hidden="true"
                      >
                        <CheckMarkIcon />
                      </span>
                      <span className="cooking-step-collapsed-summary">
                        <strong className="cooking-step-collapsed-label">
                          {`Step ${index + 1}`}
                        </strong>
                        <span
                          className="cooking-step-collapsed-sep"
                          aria-hidden="true"
                        >
                          {" — "}
                        </span>
                        <span className="cooking-step-collapsed-preview">
                          {step.text}
                        </span>
                      </span>
                      <div className="cooking-step-collapsed-actions">
                        <Button
                          variant="quiet"
                          className="cooking-step-collapsed-btn"
                          aria-expanded={false}
                          aria-label={`Expand step ${index + 1}`}
                          onClick={() => expandStep(index)}
                        >
                          Expand
                        </Button>
                        <Button
                          variant="quiet"
                          role="checkbox"
                          aria-checked={true}
                          aria-label={`Undo step ${index + 1} completion`}
                          className="cooking-step-collapsed-btn"
                          onClick={() => handleToggleStep(index)}
                        >
                          Undo
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              }

              const stateKind = isCompleted
                ? "completed"
                : isCurrent
                  ? "active"
                  : "upcoming";
              const stateLabel = isCompleted
                ? isCurrent
                  ? "Completed · Viewing"
                  : "Completed"
                : isCurrent
                  ? "Active step"
                  : "Upcoming";

              return (
                <li
                  key={index}
                  ref={(node) => {
                    stepRefs.current[index] = node;
                  }}
                  className={`cooking-step-card cooking-step-card--${stateKind}${isCurrent ? " is-focused" : ""}`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <div className="cooking-step-header">
                    <div className="cooking-step-meta">
                      <span className="cooking-step-number">{`Step ${index + 1}`}</span>
                      <span className={`cooking-step-badge cooking-step-badge--${stateKind}`}>
                        {isCompleted ? <CheckMarkIcon /> : null}
                        <span>{stateLabel}</span>
                      </span>
                      {!isCurrent ? (
                        <Button
                          variant="quiet"
                          className="cooking-step-focus-btn"
                          onClick={() => focusAndScrollToStep(index)}
                        >
                          Focus step
                        </Button>
                      ) : null}
                      {isCompleted && !isCurrent && isExpanded ? (
                        <Button
                          variant="quiet"
                          className="cooking-step-focus-btn"
                          aria-expanded={true}
                          onClick={() => collapseStep(index)}
                        >
                          Collapse
                        </Button>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isCompleted}
                      aria-label={
                        isCompleted
                          ? `Undo step ${index + 1} completion`
                          : `Mark step ${index + 1} complete`
                      }
                      className={`cooking-corner-checkbox${isCompleted ? " is-checked" : ""}`}
                      onClick={() => handleToggleStep(index)}
                    >
                      <span className="cooking-corner-box" aria-hidden="true">
                        {isCompleted ? <CheckMarkIcon /> : null}
                      </span>
                    </button>
                  </div>

                  <p className="cooking-step-text">{step.text}</p>

                  {step.ingredients.length > 0 ? (
                    <div className="cooking-step-ingredients">
                      <h3 className="cooking-step-subhead">For this step</h3>
                      <ul className="cooking-step-ing-list">
                        {step.ingredients.map((item, ingIdx) => {
                          const key = `${index}:${ingIdx}`;
                          const checked = checkedStepIngSet.has(key);
                          const miniThumb =
                            isCurrent && !isCompleted && extras.ingredientImages
                              ? resolvePantryIngredientAsset(item.label)?.imageUrl
                              : null;
                          return (
                            <li key={ingIdx}>
                              <label
                                className={`cooking-step-ing-chip${checked ? " is-checked" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    client.toggleStepIngredient(index, ingIdx)
                                  }
                                />
                                <span className="cooking-check-box" aria-hidden="true">
                                  {checked ? <CheckMarkIcon /> : null}
                                </span>
                                {miniThumb ? (
                                  <img
                                    className="ingredient-thumb ingredient-thumb--mini"
                                    src={miniThumb}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : null}
                                <span>{item.label}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}

                  {step.timers && step.timers.length > 0 ? (
                    <div className="cooking-step-timers">
                      {step.timers.map((timerDef) => {
                        const activeForDef = extras.timers.filter(
                          (item) =>
                            item.stepIndex === index &&
                            item.label === timerDef.label,
                        );
                        const latest = activeForDef[activeForDef.length - 1];
                        return (
                          <div key={timerDef.id} className="cooking-step-timer-row">
                            <Button
                              variant="tonal"
                              onClick={() => {
                                primeTimerAudio();
                                client.startTimer(index, timerDef);
                              }}
                            >
                              {latest
                                ? `Start another: ${timerDef.label} (${formatTimerSeconds(timerDef.durationSeconds)})`
                                : `Start timer: ${timerDef.label} (${formatTimerSeconds(timerDef.durationSeconds)})`}
                            </Button>
                            {latest ? (
                              <span className="cooking-step-timer-live">
                                {latest.status === "finished"
                                  ? `Done · ${formatTimerClockValue(latest)}`
                                  : `${latest.status === "paused" ? "Paused" : "Running"} · ${formatTimerClockValue(latest)}`}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}

function CheckMarkIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 10.5 8.2 14.2 15.5 6.3" />
    </svg>
  );
}
