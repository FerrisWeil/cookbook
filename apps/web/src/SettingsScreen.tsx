import type { ThemeChoice } from "@cookbook/ui";
import { Button } from "@cookbook/ui";
import { useState } from "react";

import {
  TIMER_CHECKPOINT_OPTIONS,
  playTimerChime,
  usePreferences,
} from "./settings/preferences";

const THEME_OPTIONS: Array<{
  id: ThemeChoice;
  label: string;
  description: string;
}> = [
  {
    id: "dark",
    label: "Dark (Default)",
    description: "Obsidian slate surfaces tuned for low-glare kitchen use.",
  },
  {
    id: "light",
    label: "Light",
    description: "Warm linen paper surfaces with deep coastal ink.",
  },
  {
    id: "system",
    label: "System",
    description: "Follow your device Light or Dark appearance automatically.",
  },
];

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { theme, resolvedTheme, setTheme, cooking, updateCooking, prototype } =
    usePreferences();
  const [feedback, setFeedback] = useState<string | null>(null);

  function toggleCheckpoint(seconds: number) {
    const exists = cooking.timerChimeCheckpoints.includes(seconds);
    const next = exists
      ? cooking.timerChimeCheckpoints.filter((item) => item !== seconds)
      : [...cooking.timerChimeCheckpoints, seconds].sort((a, b) => b - a);
    updateCooking({ timerChimeCheckpoints: next });
  }

  return (
    <main className="ui-shell settings-screen">
      <div className="recipe-topbar">
        <Button className="ui-back" variant="tonal" onClick={onBack}>
          Back
        </Button>
      </div>

      <div className="settings-stack">
        <header className="settings-header">
          <h1>Settings</h1>
          <p className="settings-subtitle">
            Customize appearance, cooking step flow, timer chimes, and sample data.
          </p>
        </header>

        <section className="settings-card" aria-labelledby="settings-appearance">
          <div className="settings-card-header">
            <h2 id="settings-appearance">Appearance</h2>
            <span className="settings-status-pill">
              {`Active: ${resolvedTheme === "dark" ? "Dark" : "Light"}`}
            </span>
          </div>
          <div
            className="settings-theme-grid"
            role="radiogroup"
            aria-labelledby="settings-appearance"
          >
            {THEME_OPTIONS.map((option) => {
              const selected = theme === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`settings-theme-option${selected ? " is-selected" : ""}`}
                  onClick={() => setTheme(option.id)}
                >
                  <span className="settings-theme-title">{option.label}</span>
                  <span className="settings-theme-desc">{option.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="settings-card" aria-labelledby="settings-cooking">
          <div className="settings-card-header">
            <h2 id="settings-cooking">Cooking mode</h2>
          </div>

          <div className="settings-toggle-list">
            <label className="settings-toggle-row">
              <div className="settings-toggle-copy">
                <span className="settings-toggle-title">
                  Auto-collapse completed steps
                </span>
                <span className="settings-toggle-desc">
                  Compact finished steps to a 1-line summary row so your active step
                  stays anchored near the top.
                </span>
              </div>
              <input
                type="checkbox"
                checked={cooking.autoCollapseCompletedSteps}
                onChange={(event) =>
                  updateCooking({
                    autoCollapseCompletedSteps: event.target.checked,
                  })
                }
              />
            </label>

            <label className="settings-toggle-row">
              <div className="settings-toggle-copy">
                <span className="settings-toggle-title">
                  Auto-advance to next step
                </span>
                <span className="settings-toggle-desc">
                  Automatically focus and scroll the next incomplete step to the top
                  when you mark the active step done.
                </span>
              </div>
              <input
                type="checkbox"
                checked={cooking.autoAdvanceStep}
                onChange={(event) =>
                  updateCooking({ autoAdvanceStep: event.target.checked })
                }
              />
            </label>
          </div>
        </section>

        <section className="settings-card" aria-labelledby="settings-timers">
          <div className="settings-card-header">
            <h2 id="settings-timers">Timers &amp; audio alerts</h2>
          </div>

          <div className="settings-toggle-list">
            <label className="settings-toggle-row">
              <div className="settings-toggle-copy">
                <span className="settings-toggle-title">
                  Auto-open timer panel at finish
                </span>
                <span className="settings-toggle-desc">
                  Expand the right-side Timers panel and highlight the timer when it
                  hits 00:00.
                </span>
              </div>
              <input
                type="checkbox"
                checked={cooking.autoOpenTimersOnFinish}
                onChange={(event) =>
                  updateCooking({ autoOpenTimersOnFinish: event.target.checked })
                }
              />
            </label>

            <label className="settings-toggle-row">
              <div className="settings-toggle-copy">
                <span className="settings-toggle-title">
                  Show &ldquo;Ready at&rdquo; target time
                </span>
                <span className="settings-toggle-desc">
                  Display the projected wall-clock finish time under running timers.
                </span>
              </div>
              <input
                type="checkbox"
                checked={cooking.showReadyAtTime}
                onChange={(event) =>
                  updateCooking({ showReadyAtTime: event.target.checked })
                }
              />
            </label>

            <div className="settings-toggle-row settings-toggle-row--with-action">
              <label className="settings-toggle-inline">
                <div className="settings-toggle-copy">
                  <span className="settings-toggle-title">
                    Timer audio chimes
                  </span>
                  <span className="settings-toggle-desc">
                    Play soft Web Audio chimes at your selected checkpoints.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={cooking.timerSoundEnabled}
                  onChange={(event) =>
                    updateCooking({ timerSoundEnabled: event.target.checked })
                  }
                />
              </label>
              <Button
                variant="tonal"
                className="settings-chime-test"
                onClick={() => {
                  const ok = playTimerChime("complete");
                  setFeedback(
                    ok
                      ? "Played timer completion chime."
                      : "Audio playback unavailable in this browser.",
                  );
                }}
              >
                Test chime
              </Button>
            </div>

            <div className="settings-checkpoints-block">
              <div className="settings-checkpoints-header">
                <span className="settings-toggle-title">
                  Chime checkpoints
                </span>
                <span className="settings-toggle-desc">
                  Defaults to 1 minute remaining and completion (00:00).
                </span>
              </div>
              <div
                className="filter-pill-grid"
                role="group"
                aria-label="Timer chime checkpoints"
              >
                {TIMER_CHECKPOINT_OPTIONS.map((opt) => {
                  const checked = cooking.timerChimeCheckpoints.includes(
                    opt.seconds,
                  );
                  return (
                    <label
                      key={opt.seconds}
                      className={`filter-pill-option${checked ? " is-selected" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!cooking.timerSoundEnabled}
                        onChange={() => toggleCheckpoint(opt.seconds)}
                      />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {prototype ? (
          <section className="settings-card" aria-labelledby="settings-prototype">
            <div className="settings-card-header">
              <h2 id="settings-prototype">Prototype &amp; sample data</h2>
              <span className="settings-status-pill">TAY-36</span>
            </div>
            <p className="settings-card-help">
              All recipes, facts edits, and cooking sessions run locally on sample
              data in this browser with no API or database writes.
            </p>
            <div className="settings-proto-row">
              <span className="settings-proto-label">Simulated library state</span>
              <div
                className="prototype-control-buttons"
                role="group"
                aria-label="Simulated library state"
              >
                {(
                  [
                    { id: "normal", label: "Normal (25)" },
                    { id: "empty", label: "Empty library" },
                    { id: "loading", label: "Loading" },
                    { id: "error", label: "Error / retry" },
                  ] as const
                ).map((item) => (
                  <Button
                    key={item.id}
                    variant={prototype.mode === item.id ? "primary" : "tonal"}
                    onClick={() => prototype.onChangeMode(item.id)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="settings-proto-actions">
              <Button
                variant="danger"
                onClick={() => {
                  prototype.onResetAll();
                  setFeedback("Reset recipe edits and active cooking session.");
                }}
              >
                Reset edits &amp; cooking session
              </Button>
            </div>
          </section>
        ) : null}

        {feedback ? (
          <p className="sync-status" role="status">
            {feedback}
          </p>
        ) : null}
      </div>
    </main>
  );
}
