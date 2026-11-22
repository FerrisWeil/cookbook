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
  const prepRef = useRef<HTMLLIElement | null>(null);
  const stepRefs = useRef<Array<HTMLLIElement | null>>([]);
  const pendingScrollStepRef = useRef<number | null>(null);
  const programmaticScrollUntilRef = useRef<number>(0);

  const { cooking: cookingPrefs } = usePreferences();
  const timersDrawer = useTimersDrawer();

  const [prepOpen, setPrepOpen] = useState<boolean>(
    () =>
      extras.prepCompleted !== true &&
      displayedStep === 0 &&
      completedSteps.length === 0,
  );
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
  const totalIngredients = extras.fullIngredients.length;
  const gatheredCount = checkedIngSet.size;
  const allGathered = totalIngredients > 0 && gatheredCount >= totalIngredients;
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
  }, [extras.timers.length, prepOpen, syncStickyOffset]);

  const scrollNodeToTop = useCallback(
    (node: HTMLElement | null) => {
      syncStickyOffset();
      if (node && typeof node.scrollIntoView === "function") {
        programmaticScrollUntilRef.current = Date.now() + 650;
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
    if (pendingScrollStepRef.current === displayedStep && !prepOpen) {
      pendingScrollStepRef.current = null;
      scrollNodeToTop(stepRefs.current[displayedStep] ?? null);
    }
  }, [displayedStep, prepOpen, scrollNodeToTop]);

  // Snap smoothly to closest step card when user stops scrolling
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const handleScroll = () => {
      if (Date.now() < programmaticScrollUntilRef.current) {
        return;
      }
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
      timerId = setTimeout(() => {
        if (Date.now() < programmaticScrollUntilRef.current) {
          return;
        }
        const dock = stickyDockRef.current;
        const targetTop = dock
          ? Math.ceil(dock.getBoundingClientRect().bottom) + 16
          : 100;

        const candidates: Array<{
          key: "prep" | number;
          node: HTMLLIElement;
          dist: number;
          signedDelta: number;
        }> = [];

        if (prepRef.current) {
          const rect = prepRef.current.getBoundingClientRect();
          candidates.push({
            key: "prep",
            node: prepRef.current,
            dist: Math.abs(rect.top - targetTop),
            signedDelta: rect.top - targetTop,
          });
        }
        stepRefs.current.forEach((node, idx) => {
          if (!node) {
            return;
          }
          const rect = node.getBoundingClientRect();
          candidates.push({
            key: idx,
            node,
            dist: Math.abs(rect.top - targetTop),
            signedDelta: rect.top - targetTop,
          });
        });

        let best: (typeof candidates)[number] | null = null;
        for (const item of candidates) {
          if (!best || item.dist < best.dist) {
            best = item;
          }
        }
        if (best && best.dist > 8 && best.dist < 150) {
          scrollNodeToTop(best.node);
          if (typeof best.key === "number" && best.key !== displayedStep && !prepOpen) {
            onShow(best.key);
          }
        }
      }, 180);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
    };
  }, [displayedStep, onShow, prepOpen, scrollNodeToTop]);

  function openPrepStage() {
    setPrepOpen(true);
    programmaticScrollUntilRef.current = Date.now() + 650;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollNodeToTop(prepRef.current);
      });
    });
  }

  function closePrepToStep(stepIndex = displayedStep) {
    client.setPrepCompleted(true);
    setPrepOpen(false);
    if (stepIndex === displayedStep) {
      queueMicrotask(() => {
        scrollNodeToTop(stepRefs.current[stepIndex] ?? null);
      });
    } else {
      pendingScrollStepRef.current = stepIndex;
      onShow(stepIndex);
    }
  }

  function focusAndScrollToStep(index: number) {
    if (index < 0 || index >= totalSteps) {
      return;
    }
    if (prepOpen) {
      closePrepToStep(index);
      return;
    }
    if (index === displayedStep) {
      scrollNodeToTop(stepRefs.current[index] ?? null);
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
    if (
      !wasCompleted &&
      index === displayedStep &&
      cookingPrefs.autoAdvanceStep
    ) {
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
            {`${completedCount} of ${totalSteps} steps done · ${gatheredCount}/${totalIngredients} ingredients gathered`}
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
              {prepOpen
                ? "Step 0 · Prep"
                : `Step ${displayedStep + 1} of ${totalSteps}`}
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
              variant={prepOpen ? "primary" : "tonal"}
              className="cooking-control-ingredients-btn"
              aria-expanded={prepOpen}
              onClick={() => (prepOpen ? closePrepToStep(displayedStep) : openPrepStage())}
            >
              {`Ingredients (${gatheredCount}/${totalIngredients})`}
            </Button>
            <Button
              variant="tonal"
              onClick={() => {
                if (prepOpen) {
                  return;
                }
                if (displayedStep === 0) {
                  openPrepStage();
                  return;
                }
                focusAndScrollToStep(Math.max(0, displayedStep - 1));
              }}
              disabled={prepOpen}
            >
              Previous step
            </Button>
            {prepOpen ? (
              <Button
                variant="primary"
                className="cooking-control-complete-btn"
                onClick={() => closePrepToStep(0)}
              >
                {allGathered ? "All gathered · Start Step 1" : "Start Step 1"}
              </Button>
            ) : (
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
            )}
            <Button
              variant="tonal"
              onClick={() => {
                if (prepOpen) {
                  closePrepToStep(0);
                  return;
                }
                focusAndScrollToStep(Math.min(totalSteps - 1, displayedStep + 1));
              }}
              disabled={!prepOpen && displayedStep >= totalSteps - 1}
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

      <section
        className="cooking-steps-panel cooking-steps-panel--solo"
        aria-label="Cooking steps"
      >
        <ol className="cooking-step-cards">
          {/* Step 0: Ingredients Gathering / Prep Stage */}
          {prepOpen ? (
            <li
              key="prep"
              ref={(node) => {
                prepRef.current = node;
              }}
              className="cooking-step-card cooking-step-card--active cooking-prep-card"
              aria-current="step"
            >
              <div className="cooking-step-header">
                <div className="cooking-step-meta">
                  <span className="cooking-step-number">Step 0 · Prep</span>
                  <span className="cooking-step-badge cooking-step-badge--active">
                    Active step
                  </span>
                  <span className="cooking-panel-count">
                    {`${gatheredCount} of ${totalIngredients} gathered`}
                  </span>
                </div>
                <div className="cooking-prep-header-actions">
                  {gatheredCount > 0 ? (
                    <Button
                      variant="quiet"
                      className="cooking-clear-checks"
                      onClick={() => client.clearIngredients()}
                    >
                      Uncheck all
                    </Button>
                  ) : null}
                  <Button
                    variant="quiet"
                    className="cooking-step-focus-btn"
                    onClick={() => closePrepToStep(displayedStep)}
                  >
                    Collapse
                  </Button>
                </div>
              </div>

              <p className="cooking-prep-hint">
                Select ingredients as you pull them from your pantry. You can jump
                into Step 1 anytime, even before gathering everything.
              </p>

              <ul
                className="prep-ingredient-grid"
                aria-label="Gather ingredients checklist"
              >
                {extras.fullIngredients.map((line, idx) => {
                  const checked = checkedIngSet.has(idx);
                  const imageSrc = extras.ingredientImages?.[idx];
                  return (
                    <li key={idx}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        className={`prep-ingredient-card${checked ? " is-checked" : ""}`}
                        onClick={() => client.toggleIngredient(idx)}
                      >
                        {imageSrc ? (
                          <span
                            className="prep-ingredient-thumb"
                            aria-hidden="true"
                          >
                            <img
                              src={imageSrc}
                              alt=""
                              loading="lazy"
                              decoding="async"
                            />
                          </span>
                        ) : null}
                        <span className="prep-ingredient-text">{line}</span>
                        <span
                          className={`prep-ingredient-check${checked ? " is-checked" : ""}`}
                          aria-hidden="true"
                        >
                          {checked ? <CheckMarkIcon /> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="cooking-step-footer">
                <Button
                  variant="primary"
                  onClick={() => closePrepToStep(0)}
                >
                  {allGathered
                    ? "All gathered · Start Step 1"
                    : gatheredCount > 0
                      ? `Continue with ${gatheredCount}/${totalIngredients} · Start Step 1`
                      : "Start Step 1"}
                </Button>
              </div>
            </li>
          ) : (
            <li
              key="prep"
              ref={(node) => {
                prepRef.current = node;
              }}
              className={`cooking-step-card cooking-step-card--collapsed ${
                allGathered
                  ? "cooking-step-card--completed"
                  : "cooking-step-card--partial-prep"
              }`}
            >
              <div className="cooking-step-collapsed-row">
                <span
                  className={`cooking-step-collapsed-check${
                    allGathered ? "" : " is-partial"
                  }`}
                  aria-hidden="true"
                >
                  {allGathered ? <CheckMarkIcon /> : "•"}
                </span>
                <span className="cooking-step-collapsed-summary">
                  <strong className="cooking-step-collapsed-label">
                    Step 0 · Prep
                  </strong>
                  <span
                    className="cooking-step-collapsed-sep"
                    aria-hidden="true"
                  >
                    {" — "}
                  </span>
                  <span className="cooking-step-collapsed-preview">
                    {allGathered
                      ? `All ${totalIngredients} ingredients gathered`
                      : `${gatheredCount} of ${totalIngredients} ingredients gathered`}
                  </span>
                </span>
                <div className="cooking-step-collapsed-actions">
                  <Button
                    variant="quiet"
                    className="cooking-step-collapsed-btn"
                    aria-expanded={false}
                    onClick={openPrepStage}
                  >
                    Expand ingredients
                  </Button>
                </div>
              </div>
            </li>
          )}

          {/* Steps 1..N */}
          {extras.steps.map((step, index) => {
            const isCompleted = completedSet.has(index);
            const isCurrent = !prepOpen && displayedStep === index;
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
                        className="cooking-step-collapsed-btn"
                        role="checkbox"
                        aria-checked={true}
                        aria-label={`Undo step ${index + 1} completion`}
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
                className={`cooking-step-card cooking-step-card--${stateKind}${
                  isCurrent ? " is-focused" : ""
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                <div className="cooking-step-header">
                  <div className="cooking-step-meta">
                    <span className="cooking-step-number">
                      {`Step ${index + 1}`}
                    </span>
                    <span
                      className={`cooking-step-badge cooking-step-badge--${stateKind}`}
                    >
                      {isCompleted ? <CheckMarkIcon /> : null}
                      <span>{stateLabel}</span>
                    </span>
                    {!isCurrent ? (
                      <Button
                        variant="quiet"
                        className="cooking-step-focus-btn"
                        onClick={() => {
                          if (prepOpen) {
                            closePrepToStep(index);
                          } else {
                            onShow(index);
                          }
                        }}
                      >
                        Focus step
                      </Button>
                    ) : null}
                    {isCompleted && isExpanded && !isCurrent ? (
                      <Button
                        variant="quiet"
                        className="cooking-step-focus-btn"
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

                {!isCompleted && isCurrent ? (
                  <div className="cooking-step-footer">
                    <Button
                      variant="primary"
                      onClick={() => handleToggleStep(index)}
                    >
                      {index < totalSteps - 1
                        ? "Done · Next step"
                        : "Mark final step done"}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>
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
