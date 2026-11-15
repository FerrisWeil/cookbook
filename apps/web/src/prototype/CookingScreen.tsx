import { Button, Message } from "@cookbook/ui";
import { useEffect, useRef, useState } from "react";

import {
  formatRemaining,
  remainingMs,
  stepStatus,
} from "./cooking-state";
import { usePrototypeCooking } from "./runtime";
import type { PrototypeRecipe, PrototypeTimer } from "./types";

export function CookingScreen({ onLeave }: { onLeave: () => void }) {
  const cooking = usePrototypeCooking();
  const [, setTick] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => cooking?.subscribe(() => setTick((value) => value + 1)), [cooking]);
  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!cooking) {
    return null;
  }

  const state = cooking.state();
  const recipe = cooking.recipe();
  if (!state || !recipe) {
    return (
      <main className="ui-shell">
        <Button className="ui-back" variant="primary" onClick={onLeave}>
          Back
        </Button>
        <Message>There is no active cooking session.</Message>
      </main>
    );
  }

  const opened = state.timers.find((timer) => timer.id === state.openedTimerId) ?? null;
  const now = Date.now();

  return (
    <main className="ui-shell">
      <div className="proto-cooking">
        <div className="proto-cooking-header">
          <Button className="ui-back" variant="primary" onClick={onLeave}>
            Back
          </Button>
          <h1>{recipe.title}</h1>
          <Button variant="danger" onClick={() => cooking.end()}>
            End session
          </Button>
        </div>
        <TimerBar
          timers={state.timers}
          now={now}
          onOpen={(id) => cooking.openTimer(id)}
        />
        <IngredientPanel
          recipe={recipe}
          checked={state.checkedIngredientIds}
          onToggle={(id) => cooking.toggleIngredient(id)}
        />
        <StepList
          recipe={recipe}
          completed={state.completedSteps}
          runningSteps={state.timers.map((timer) => timer.stepIndex)}
          onToggle={(index) => cooking.toggleStep(index)}
          onStartTimer={(index) => cooking.startTimer(index)}
        />
      </div>
      <TimerDialog
        dialogRef={dialogRef}
        timer={opened}
        now={now}
        onClose={() => cooking.openTimer(null)}
      />
    </main>
  );
}

function TimerBar({
  timers,
  now,
  onOpen,
}: {
  timers: PrototypeTimer[];
  now: number;
  onOpen: (id: string) => void;
}) {
  if (timers.length === 0) {
    return null;
  }
  return (
    <div className="proto-timers" role="region" aria-label="Timers">
      {timers.map((timer) => {
        const left = remainingMs(timer, now);
        const label = `${timer.label} ${left === 0 ? "Done" : formatRemaining(left)}`;
        return (
          <Button
            key={timer.id}
            className="proto-timer"
            variant="tonal"
            onClick={() => onOpen(timer.id)}
            aria-label={`Open timer ${label}`}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}

function IngredientPanel({
  recipe,
  checked,
  onToggle,
}: {
  recipe: PrototypeRecipe;
  checked: readonly string[];
  onToggle: (id: string) => void;
}) {
  if (recipe.ingredients.length === 0) {
    return null;
  }
  return (
    <section className="proto-ingredients" aria-labelledby="proto-ings-title">
      <h2 id="proto-ings-title">Ingredients</h2>
      <ul className="proto-ingredient-list">
        {recipe.ingredients.map((ingredient) => {
          const isChecked = checked.includes(ingredient.id);
          return (
            <li key={ingredient.id}>
              <label>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggle(ingredient.id)}
                />
                <span>{ingredient.line}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StepList({
  recipe,
  completed,
  runningSteps,
  onToggle,
  onStartTimer,
}: {
  recipe: PrototypeRecipe;
  completed: readonly number[];
  runningSteps: readonly number[];
  onToggle: (index: number) => void;
  onStartTimer: (index: number) => void;
}) {
  if (recipe.steps.length === 0) {
    return (
      <section className="proto-steps">
        <h2>Steps</h2>
        <Message tone="info">This recipe has no steps yet.</Message>
      </section>
    );
  }
  return (
    <section className="proto-steps" aria-labelledby="proto-steps-title">
      <h2 id="proto-steps-title">Steps</h2>
      <ol className="proto-step-list">
        {recipe.steps.map((entry, index) => {
          const status = stepStatus(index, completed, recipe.steps.length);
          const statusLabel =
            status === "completed"
              ? "Completed"
              : status === "current"
                ? "Current"
                : "Upcoming";
          const canTime =
            entry.durationSeconds !== undefined &&
            entry.durationSeconds > 0 &&
            !runningSteps.includes(index);
          const linked = entry.ingredients
            .map((link) => {
              const ingredient = recipe.ingredients.find(
                (item) => item.id === link.ingredientId,
              );
              if (!ingredient) {
                return null;
              }
              return `${link.amount} ${ingredient.name}`;
            })
            .filter((item): item is string => item !== null);
          return (
            <li
              key={index}
              className={`proto-step proto-step--${status}`}
              aria-current={status === "current" ? "step" : undefined}
            >
              <p className="proto-step-status">{statusLabel}</p>
              <label className="proto-step-check">
                <input
                  type="checkbox"
                  checked={status === "completed"}
                  onChange={() => onToggle(index)}
                />
                <span className="visually-hidden">
                  {status === "completed"
                    ? `Undo step ${index + 1}`
                    : `Complete step ${index + 1}`}
                </span>
              </label>
              <p className="proto-step-text">{entry.text}</p>
              {linked.length > 0 ? (
                <ul className="proto-step-ings">
                  {linked.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
              {canTime ? (
                <div className="proto-step-actions">
                  <Button variant="tonal" onClick={() => onStartTimer(index)}>
                    {`Start ${entry.timerLabel ?? "timer"}`}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function TimerDialog({
  dialogRef,
  timer,
  now,
  onClose,
}: {
  dialogRef: { current: HTMLDialogElement | null };
  timer: PrototypeTimer | null;
  now: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (timer && !dialog.open) {
      dialog.showModal();
    }
    if (!timer && dialog.open) {
      dialog.close();
    }
  }, [dialogRef, timer]);

  const left = timer ? remainingMs(timer, now) : 0;
  return (
    <dialog
      ref={dialogRef}
      className="proto-timer-dialog"
      aria-labelledby="proto-timer-title"
      onClose={onClose}
      onCancel={onClose}
    >
      {timer ? (
        <>
          <h2 id="proto-timer-title">{timer.label}</h2>
          <p className="proto-timer-remaining" aria-live="polite">
            {left === 0 ? "Done" : formatRemaining(left)}
          </p>
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </>
      ) : null}
    </dialog>
  );
}
