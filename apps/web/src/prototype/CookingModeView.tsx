import { Button, Message } from "@cookbook/ui";
import { useEffect, useRef } from "react";

import {
  formatTimerSeconds,
  type PrototypeCookingClient,
  type PrototypeCookingExtras,
  type PrototypeTimer,
} from "./cookingStore";

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
  const stepRefs = useRef<Array<HTMLLIElement | null>>([]);
  const fullscreenDialogRef = useRef<HTMLDialogElement>(null);

  const fullscreenTimer =
    extras.fullscreenTimerId !== null
      ? (extras.timers.find((item) => item.id === extras.fullscreenTimerId) ?? null)
      : null;

  useEffect(() => {
    const dialog = fullscreenDialogRef.current;
    if (!dialog) {
      return;
    }
    if (fullscreenTimer && !dialog.open) {
      dialog.showModal();
    } else if (!fullscreenTimer && dialog.open) {
      dialog.close();
    }
  }, [fullscreenTimer]);

  const completedSet = new Set(completedSteps);
  const completedCount = completedSteps.length;
  const totalSteps = extras.steps.length;
  const progressPercent =
    totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const checkedIngSet = new Set(extras.checkedIngredients);
  const checkedStepIngSet = new Set(extras.checkedStepIngredients);

  function focusAndScrollToStep(index: number) {
    onShow(index);
    const node = stepRefs.current[index];
    if (node && typeof node.scrollIntoView === "function") {
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      node.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "nearest",
      });
    }
  }

  function handleToggleStep(index: number) {
    const wasCompleted = completedSet.has(index);
    client.toggleStepCompleted(index);
    if (!wasCompleted && index === displayedStep) {
      const nextSet = new Set([...completedSteps, index]);
      const nextIncomplete = extras.steps.findIndex(
        (_, candidate) => candidate > index && !nextSet.has(candidate),
      );
      if (nextIncomplete !== -1) {
        onShow(nextIncomplete);
      }
    }
  }

  return (
    <div className="cooking-workspace">
      <div className="cooking-topbar">
        <div className="cooking-topbar-nav">
          <Button className="ui-back" variant="tonal" onClick={onBack}>
            Back
          </Button>
          <p className="cooking-session-meta" role="status">
            {`${completedCount} of ${totalSteps} steps done · Saved in this browser`}
          </p>
        </div>
        <div className="cooking-topbar-actions">
          <Button
            variant="tonal"
            onClick={() => focusAndScrollToStep(Math.max(0, displayedStep - 1))}
            disabled={displayedStep === 0}
          >
            Previous step
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
          <Button variant="danger" onClick={onFinish}>
            End cooking session
          </Button>
        </div>
      </div>

      <div className="cooking-hero">
        <h1 className="cooking-title">{extras.recipeTitle}</h1>
        <div className="cooking-progress" aria-hidden="true">
          <div className="cooking-progress-track">
            <div
              className="cooking-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="cooking-progress-label">{`${progressPercent}%`}</span>
        </div>
      </div>
      {error ? <Message>{error}</Message> : null}

      {extras.timers.length > 0 ? (
        <section className="cooking-timer-dock" aria-label="Active timers">
          <div className="cooking-timer-dock-header">
            <span className="cooking-timer-dock-title">
              {`Timers (${extras.timers.length})`}
            </span>
          </div>
          <ul className="cooking-timer-list">
            {extras.timers.map((timer) => (
              <TimerStripCard
                key={timer.id}
                timer={timer}
                onPause={() => client.pauseTimer(timer.id)}
                onResume={() => client.resumeTimer(timer.id)}
                onAddMinute={() => client.addTimerSeconds(timer.id, 60)}
                onFullscreen={() => client.openTimerFullscreen(timer.id)}
                onDismiss={() => client.dismissTimer(timer.id)}
              />
            ))}
          </ul>
        </section>
      ) : null}

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
                          onClick={() => onShow(index)}
                        >
                          Focus step
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
                              onClick={() => client.startTimer(index, timerDef)}
                            >
                              {latest
                                ? `Start another: ${timerDef.label} (${formatTimerSeconds(timerDef.durationSeconds)})`
                                : `Start timer: ${timerDef.label} (${formatTimerSeconds(timerDef.durationSeconds)})`}
                            </Button>
                            {latest ? (
                              <span className="cooking-step-timer-live">
                                {latest.status === "finished"
                                  ? `Done · ${formatTimerSeconds(0)}`
                                  : `${latest.status === "paused" ? "Paused" : "Running"} · ${formatTimerSeconds(latest.remainingSeconds)}`}
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
                        {index < totalSteps - 1 ? "Done · Next step" : "Mark final step done"}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <dialog
        ref={fullscreenDialogRef}
        className="cooking-timer-fullscreen"
        aria-label={
          fullscreenTimer
            ? `Timer: ${fullscreenTimer.label}`
            : "Full screen timer"
        }
        onClose={() => client.closeTimerFullscreen()}
        onCancel={() => client.closeTimerFullscreen()}
      >
        {fullscreenTimer ? (
          <div className="cooking-fullscreen-inner">
            <div className="cooking-fullscreen-top">
              <p className="cooking-fullscreen-step">
                {`${extras.recipeTitle} · Step ${fullscreenTimer.stepIndex + 1}`}
              </p>
              <Button
                variant="primary"
                onClick={() => client.closeTimerFullscreen()}
              >
                Close full screen
              </Button>
            </div>

            <div className="cooking-fullscreen-center">
              <h2 className="cooking-fullscreen-label">{fullscreenTimer.label}</h2>
              <p
                className={`cooking-fullscreen-clock${fullscreenTimer.status === "finished" ? " is-finished" : ""}`}
                aria-live="off"
              >
                {formatTimerSeconds(fullscreenTimer.remainingSeconds)}
              </p>
              <div className="cooking-fullscreen-meter" aria-hidden="true">
                <div
                  className={`cooking-fullscreen-meter-fill${fullscreenTimer.status === "finished" ? " is-finished" : ""}`}
                  style={{
                    width: `${
                      fullscreenTimer.durationSeconds > 0
                        ? Math.min(
                            100,
                            Math.max(
                              0,
                              Math.round(
                                (fullscreenTimer.remainingSeconds /
                                  fullscreenTimer.durationSeconds) *
                                  100,
                              ),
                            ),
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
              <p className="cooking-fullscreen-status" role="status">
                {fullscreenTimer.status === "finished"
                  ? "Timer finished!"
                  : fullscreenTimer.status === "paused"
                    ? "Paused"
                    : "Running"}
              </p>
              <div className="cooking-fullscreen-actions">
                {fullscreenTimer.status === "running" ? (
                  <Button
                    variant="primary"
                    onClick={() => client.pauseTimer(fullscreenTimer.id)}
                  >
                    Pause
                  </Button>
                ) : fullscreenTimer.status === "paused" ? (
                  <Button
                    variant="primary"
                    onClick={() => client.resumeTimer(fullscreenTimer.id)}
                  >
                    Resume
                  </Button>
                ) : null}
                <Button
                  variant="tonal"
                  onClick={() => client.addTimerSeconds(fullscreenTimer.id, 60)}
                >
                  +1 min
                </Button>
                <Button
                  variant="tonal"
                  onClick={() => client.resetTimer(fullscreenTimer.id)}
                >
                  Reset
                </Button>
                <Button
                  variant="danger"
                  onClick={() => client.dismissTimer(fullscreenTimer.id)}
                >
                  Dismiss timer
                </Button>
              </div>
            </div>

            {extras.timers.length > 1 ? (
              <div className="cooking-fullscreen-switcher">
                <span className="cooking-fullscreen-switcher-label">
                  All active timers:
                </span>
                <div className="cooking-fullscreen-switcher-list">
                  {extras.timers.map((item) => (
                    <Button
                      key={item.id}
                      variant={
                        item.id === fullscreenTimer.id ? "primary" : "tonal"
                      }
                      onClick={() => client.openTimerFullscreen(item.id)}
                    >
                      {`${item.label} · ${formatTimerSeconds(item.remainingSeconds)}`}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </div>
  );
}

function TimerStripCard({
  timer,
  onPause,
  onResume,
  onAddMinute,
  onFullscreen,
  onDismiss,
}: {
  timer: PrototypeTimer;
  onPause: () => void;
  onResume: () => void;
  onAddMinute: () => void;
  onFullscreen: () => void;
  onDismiss: () => void;
}) {
  return (
    <li
      className={`cooking-timer-chip cooking-timer-chip--${timer.status}`}
    >
      <div className="cooking-timer-chip-info">
        <span className="cooking-timer-chip-label">{timer.label}</span>
        <span className="cooking-timer-chip-meta">
          {`Step ${timer.stepIndex + 1} · ${
            timer.status === "finished"
              ? "Done!"
              : timer.status === "paused"
                ? "Paused"
                : "Running"
          }`}
        </span>
      </div>
      <span className="cooking-timer-chip-clock">
        {formatTimerSeconds(timer.remainingSeconds)}
      </span>
      <div className="cooking-timer-chip-controls">
        {timer.status === "running" ? (
          <Button variant="tonal" onClick={onPause} aria-label={`Pause ${timer.label}`}>
            Pause
          </Button>
        ) : timer.status === "paused" ? (
          <Button variant="primary" onClick={onResume} aria-label={`Resume ${timer.label}`}>
            Resume
          </Button>
        ) : null}
        <Button
          variant="tonal"
          onClick={onAddMinute}
          aria-label={`Add 1 minute to ${timer.label}`}
        >
          +1m
        </Button>
        <Button
          variant="tonal"
          onClick={onFullscreen}
          aria-label={`Open ${timer.label} full screen`}
        >
          Full screen
        </Button>
        <Button
          variant="quiet"
          onClick={onDismiss}
          aria-label={`Dismiss ${timer.label}`}
        >
          Dismiss
        </Button>
      </div>
    </li>
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
