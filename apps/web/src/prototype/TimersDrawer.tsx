import { Button } from "@cookbook/ui";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { pushAppPath } from "../navigate";
import { recipePath } from "../route";
import {
  TIMER_CHECKPOINT_OPTIONS,
  playTimerChime,
  primeTimerAudio,
  usePreferences,
} from "../settings/preferences";
import {
  formatTimerClockValue,
  formatTimerSeconds,
  type PrototypeCookingClient,
  type PrototypeTimer,
} from "./cookingStore";
import {
  SevenSegmentClock,
  formatReadyAtClock,
  type ClockTone,
} from "./SevenSegmentClock";

const QUICK_ADHOC_MINUTES = [1, 3, 5, 10, 15, 30] as const;

type TimersDrawerContextValue = {
  open: boolean;
  setOpen: (next: boolean) => void;
  toggle: () => void;
};

const TimersDrawerContext = createContext<TimersDrawerContextValue | null>(null);

export function useTimersDrawer(): TimersDrawerContextValue {
  const ctx = useContext(TimersDrawerContext);
  if (ctx) {
    return ctx;
  }
  return {
    open: false,
    setOpen: () => {},
    toggle: () => {},
  };
}

export function timerClockTone(timer: PrototypeTimer): ClockTone {
  if (timer.status === "finished") {
    return "finished";
  }
  if (timer.status === "paused") {
    return "paused";
  }
  if (timer.remainingSeconds <= 60) {
    return "warning";
  }
  return "running";
}

function sortTimersSoonest(timers: PrototypeTimer[]): PrototypeTimer[] {
  return [...timers].sort((a, b) => {
    const rank = (t: PrototypeTimer) =>
      t.status === "finished" ? 0 : t.status === "running" ? 1 : 2;
    const rDiff = rank(a) - rank(b);
    if (rDiff !== 0) {
      return rDiff;
    }
    if (a.status === "finished" && b.status === "finished") {
      return (b.overtimeSeconds ?? 0) - (a.overtimeSeconds ?? 0);
    }
    return a.remainingSeconds - b.remainingSeconds;
  });
}

export function TimersDrawerProvider({
  client,
  children,
}: {
  client: PrototypeCookingClient;
  children: ReactNode;
}) {
  const { cooking: prefs } = usePreferences();
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customMinutes, setCustomMinutes] = useState<number>(8);
  const [customLabel, setCustomLabel] = useState<string>("");
  const [customOpen, setCustomOpen] = useState<boolean>(false);
  const fullscreenDialogRef = useRef<HTMLDialogElement>(null);

  const prevSnapshotRef = useRef<
    Map<string, { status: PrototypeTimer["status"]; remaining: number }>
  >(new Map());
  const firedRef = useRef<Map<string, Set<number>>>(new Map());

  useEffect(() => {
    return client.subscribe(() => setTick((v) => v + 1));
  }, [client]);

  const timers = client.getTimers();
  const sortedTimers = useMemo(() => sortTimersSoonest(timers), [timers]);
  const soonestTimer = sortedTimers[0] ?? null;
  const fullscreenTimerId = client.getFullscreenTimerId();
  const fullscreenTimer =
    fullscreenTimerId !== null
      ? (timers.find((item) => item.id === fullscreenTimerId) ?? null)
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

  // Clear selection if that timer is dismissed
  useEffect(() => {
    if (selectedId && !timers.some((t) => t.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, timers]);

  // Watch reminder checkpoints (default: 60s + 0s complete) and auto-open on finish
  useEffect(() => {
    const prevMap = prevSnapshotRef.current;
    const nextMap = new Map<
      string,
      { status: PrototypeTimer["status"]; remaining: number }
    >();
    const activeIds = new Set(timers.map((t) => t.id));
    for (const id of firedRef.current.keys()) {
      if (!activeIds.has(id)) {
        firedRef.current.delete(id);
      }
    }

    let finishedTimerId: string | null = null;
    let shouldPlayComplete = false;
    let shouldPlayReminder = false;

    for (const timer of timers) {
      nextMap.set(timer.id, {
        status: timer.status,
        remaining: timer.remainingSeconds,
      });
      const prev = prevMap.get(timer.id);
      if (!firedRef.current.has(timer.id)) {
        firedRef.current.set(timer.id, new Set());
      }
      const fired = firedRef.current.get(timer.id)!;

      // Reset fired checkpoints if timer was restarted or pushed back above threshold
      if (timer.status === "running") {
        for (const cp of [...fired]) {
          if (timer.remainingSeconds > cp + 2) {
            fired.delete(cp);
          }
        }
      }

      if (prev) {
        if (prev.status === "running" && timer.status === "finished") {
          finishedTimerId = timer.id;
          if (
            prefs.timerChimeCheckpoints.includes(0) &&
            !fired.has(0)
          ) {
            fired.add(0);
            shouldPlayComplete = true;
          }
        } else if (timer.status === "running") {
          for (const cp of prefs.timerChimeCheckpoints) {
            if (cp > 0 && prev.remaining > cp && timer.remainingSeconds <= cp && !fired.has(cp)) {
              fired.add(cp);
              shouldPlayReminder = true;
            }
          }
        }
      }
    }

    prevSnapshotRef.current = nextMap;

    if (prefs.timerSoundEnabled) {
      if (shouldPlayComplete) {
        playTimerChime("complete");
      } else if (shouldPlayReminder) {
        playTimerChime("reminder");
      }
    }

    if (finishedTimerId && prefs.autoOpenTimersOnFinish) {
      setOpen(true);
      setSelectedId(finishedTimerId);
    }
  }, [
    prefs.autoOpenTimersOnFinish,
    prefs.timerChimeCheckpoints,
    prefs.timerSoundEnabled,
    timers,
  ]);

  // Escape closes selected timer first, then drawer when focus is inside
  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !fullscreenTimer) {
        if (selectedId) {
          setSelectedId(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreenTimer, open, selectedId]);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  function handleQuickStart(minutes: number) {
    primeTimerAudio();
    client.startAdhocTimer(minutes * 60);
    setOpen(true);
  }

  function handleCustomStart() {
    primeTimerAudio();
    const mins = Math.max(1, Math.min(1440, Math.round(customMinutes || 1)));
    client.startAdhocTimer(mins * 60, customLabel);
    setCustomLabel("");
    setCustomOpen(false);
    setOpen(true);
  }

  function handleJumpToStep(timer: PrototypeTimer) {
    if (timer.stepIndex === null) {
      return;
    }
    const stepIndex = timer.stepIndex;
    const extras = client.getExtras();
    const targetRecipeId = timer.recipeId ?? extras?.recipeId;
    void client.show(stepIndex);
    if (
      targetRecipeId &&
      typeof window !== "undefined" &&
      window.location.pathname !== recipePath(targetRecipeId)
    ) {
      pushAppPath(recipePath(targetRecipeId), window.history, window.location);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }

  const edgeTone: ClockTone = soonestTimer
    ? timerClockTone(soonestTimer)
    : "running";

  return (
    <TimersDrawerContext.Provider value={{ open, setOpen, toggle }}>
      <div className={`app-stage${open ? " is-timers-open" : ""}`}>
        <div className="app-stage-main">{children}</div>

        {open ? (
          <aside
            className="right-side-drawer"
            aria-label="Timers side panel"
          >
            <div className="right-drawer-header">
              <div className="right-drawer-title-group">
                <TimerIcon />
                <h2>Timers</h2>
                {timers.length > 0 ? (
                  <span className="right-drawer-badge">{timers.length}</span>
                ) : null}
              </div>
              <Button
                variant="quiet"
                className="right-drawer-close"
                aria-label="Hide timers panel"
                onClick={() => setOpen(false)}
              >
                Hide
              </Button>
            </div>

            <div className="timers-adhoc-box">
              <div className="timers-adhoc-header">
                <span className="timers-adhoc-heading">Quick timer</span>
                <Button
                  variant="quiet"
                  className="timers-custom-toggle"
                  aria-expanded={customOpen}
                  onClick={() => setCustomOpen((prev) => !prev)}
                >
                  {customOpen ? "Cancel" : "Custom"}
                </Button>
              </div>
              <div
                className="timers-quick-chips"
                role="group"
                aria-label="Start ad-hoc timer duration"
              >
                {QUICK_ADHOC_MINUTES.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    className="timers-quick-chip"
                    onClick={() => handleQuickStart(mins)}
                  >
                    {`${mins}m`}
                  </button>
                ))}
              </div>

              {customOpen ? (
                <div className="timers-custom-form">
                  <label className="timers-custom-field">
                    <span>Label (optional)</span>
                    <input
                      type="text"
                      placeholder="Kitchen timer"
                      maxLength={50}
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                    />
                  </label>
                  <div className="timers-custom-duration-row">
                    <Button
                      variant="tonal"
                      onClick={() =>
                        setCustomMinutes((m) => Math.max(1, (m || 1) - 1))
                      }
                      aria-label="Decrease minutes"
                    >
                      -1m
                    </Button>
                    <input
                      type="number"
                      aria-label="Timer minutes"
                      min={1}
                      max={1440}
                      value={customMinutes}
                      onChange={(e) =>
                        setCustomMinutes(
                          Math.max(1, Number.parseInt(e.target.value || "1", 10) || 1),
                        )
                      }
                    />
                    <Button
                      variant="tonal"
                      onClick={() =>
                        setCustomMinutes((m) => Math.min(1440, (m || 1) + 1))
                      }
                      aria-label="Increase minutes"
                    >
                      +1m
                    </Button>
                    <Button variant="primary" onClick={handleCustomStart}>
                      Start
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="right-drawer-body">
              {sortedTimers.length === 0 ? (
                <div className="timers-empty-state">
                  <p className="timers-empty-title">No active timers</p>
                  <p className="timers-empty-hint">
                    Tap a quick duration above or start a timer directly from a
                    recipe step.
                  </p>
                </div>
              ) : (
                <ul className="timers-stack-list">
                  {sortedTimers.map((timer) => {
                    const isSelected = selectedId === timer.id;
                    const tone = timerClockTone(timer);
                    const clockValue = formatTimerClockValue(timer);
                    return (
                      <li
                        key={timer.id}
                        className={`timer-stack-card timer-stack-card--${tone}${
                          isSelected ? " is-selected" : ""
                        }`}
                      >
                        <button
                          type="button"
                          className="timer-stack-card-trigger"
                          aria-expanded={isSelected}
                          onClick={() =>
                            setSelectedId((prev) =>
                              prev === timer.id ? null : timer.id,
                            )
                          }
                        >
                          <span className="timer-stack-meta">
                            <span className="timer-stack-title-row">
                              <span className="timer-stack-icon" aria-hidden="true">
                                {timer.stepIndex !== null ? (
                                  <span className="timer-step-dot">
                                    {`S${timer.stepIndex + 1}`}
                                  </span>
                                ) : (
                                  <TimerIcon size={15} />
                                )}
                              </span>
                              <span className="timer-stack-name">
                                {timer.label}
                              </span>
                            </span>
                            {prefs.showReadyAtTime &&
                            timer.status === "running" &&
                            timer.endAtMs ? (
                              <span className="timer-ready-at">
                                {`Ready at ${formatReadyAtClock(timer.endAtMs)}`}
                              </span>
                            ) : timer.status === "paused" ? (
                              <span className="timer-ready-at">Paused</span>
                            ) : timer.status === "finished" ? (
                              <span className="timer-ready-at timer-ready-at--finished">
                                Time up · Overtime
                              </span>
                            ) : null}
                          </span>

                          <SevenSegmentClock
                            value={clockValue}
                            tone={tone}
                            size="sm"
                            ariaLabel={`${timer.label} ${clockValue}`}
                          />
                        </button>

                        {isSelected ? (
                          <div
                            className="timer-stack-controls"
                            role="group"
                            aria-label={`Controls for ${timer.label}`}
                          >
                            {timer.stepIndex !== null ? (
                              <Button
                                variant="tonal"
                                onClick={() => handleJumpToStep(timer)}
                              >
                                {`Jump to step ${timer.stepIndex + 1}`}
                              </Button>
                            ) : null}
                            <Button
                              variant="tonal"
                              onClick={() => client.addTimerSeconds(timer.id, -60)}
                              disabled={
                                timer.status === "finished" ||
                                timer.remainingSeconds <= 0
                              }
                            >
                              -1m
                            </Button>
                            <Button
                              variant="tonal"
                              onClick={() => {
                                primeTimerAudio();
                                client.addTimerSeconds(timer.id, 60);
                              }}
                            >
                              +1m
                            </Button>
                            {timer.status === "running" ? (
                              <Button
                                variant="tonal"
                                onClick={() => client.pauseTimer(timer.id)}
                              >
                                Stop
                              </Button>
                            ) : timer.status === "paused" ? (
                              <Button
                                variant="primary"
                                onClick={() => {
                                  primeTimerAudio();
                                  client.resumeTimer(timer.id);
                                }}
                              >
                                Resume
                              </Button>
                            ) : null}
                            <Button
                              variant="tonal"
                              onClick={() => {
                                primeTimerAudio();
                                client.restartTimer(timer.id);
                              }}
                            >
                              Restart
                            </Button>
                            <Button
                              variant="tonal"
                              onClick={() => client.openTimerFullscreen(timer.id)}
                            >
                              Full screen
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => client.dismissTimer(timer.id)}
                            >
                              Dismiss
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="right-drawer-footer">
              <span className="right-drawer-chime-hint">
                {prefs.timerSoundEnabled
                  ? `Chimes: ${
                      prefs.timerChimeCheckpoints.length === 0
                        ? "Muted"
                        : prefs.timerChimeCheckpoints
                            .map(
                              (sec) =>
                                TIMER_CHECKPOINT_OPTIONS.find(
                                  (o) => o.seconds === sec,
                                )?.label ?? `${sec}s`,
                            )
                            .join(", ")
                    }`
                  : "Chimes off"}
              </span>
            </div>
          </aside>
        ) : (
          <button
            type="button"
            className={`timers-edge-handle timers-edge-handle--${
              soonestTimer ? edgeTone : "idle"
            }`}
            aria-label={
              soonestTimer
                ? `Show timers panel. Soonest timer ${soonestTimer.label} ${formatTimerClockValue(soonestTimer)}`
                : "Show timers panel"
            }
            aria-expanded={false}
            onClick={() => setOpen(true)}
          >
            <TimerIcon size={18} />
            {soonestTimer ? (
              <span className="timers-edge-readout">
                <SevenSegmentClock
                  value={formatTimerClockValue(soonestTimer)}
                  tone={edgeTone}
                  size="xs"
                />
                {sortedTimers.length > 1 ? (
                  <span className="timers-edge-count">{sortedTimers.length}</span>
                ) : null}
              </span>
            ) : (
              <span className="timers-edge-label">Timers</span>
            )}
          </button>
        )}
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
                {fullscreenTimer.stepIndex !== null
                  ? `${fullscreenTimer.recipeTitle ?? "Recipe"} · Step ${fullscreenTimer.stepIndex + 1}`
                  : "Ad-hoc kitchen timer"}
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
              <div aria-live="off">
                <SevenSegmentClock
                  value={formatTimerClockValue(fullscreenTimer)}
                  tone={timerClockTone(fullscreenTimer)}
                  size="xl"
                  ariaLabel={`${fullscreenTimer.label} ${formatTimerClockValue(fullscreenTimer)}`}
                />
              </div>
              {prefs.showReadyAtTime &&
              fullscreenTimer.status === "running" &&
              fullscreenTimer.endAtMs ? (
                <p className="cooking-fullscreen-ready">
                  {`Ready at ${formatReadyAtClock(fullscreenTimer.endAtMs)}`}
                </p>
              ) : null}
              <div className="cooking-fullscreen-meter" aria-hidden="true">
                <div
                  className={`cooking-fullscreen-meter-fill${
                    fullscreenTimer.status === "finished" ? " is-finished" : ""
                  }`}
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
                  ? "Timer finished — counting overtime"
                  : fullscreenTimer.status === "paused"
                    ? "Paused"
                    : "Running"}
              </p>
              <div className="cooking-fullscreen-actions">
                <Button
                  variant="tonal"
                  onClick={() =>
                    client.addTimerSeconds(fullscreenTimer.id, -60)
                  }
                  disabled={
                    fullscreenTimer.status === "finished" ||
                    fullscreenTimer.remainingSeconds <= 0
                  }
                >
                  -1 min
                </Button>
                {fullscreenTimer.status === "running" ? (
                  <Button
                    variant="primary"
                    onClick={() => client.pauseTimer(fullscreenTimer.id)}
                  >
                    Stop
                  </Button>
                ) : fullscreenTimer.status === "paused" ? (
                  <Button
                    variant="primary"
                    onClick={() => {
                      primeTimerAudio();
                      client.resumeTimer(fullscreenTimer.id);
                    }}
                  >
                    Resume
                  </Button>
                ) : null}
                <Button
                  variant="tonal"
                  onClick={() => {
                    primeTimerAudio();
                    client.addTimerSeconds(fullscreenTimer.id, 60);
                  }}
                >
                  +1 min
                </Button>
                <Button
                  variant="tonal"
                  onClick={() => {
                    primeTimerAudio();
                    client.restartTimer(fullscreenTimer.id);
                  }}
                >
                  Restart
                </Button>
                <Button
                  variant="danger"
                  onClick={() => client.dismissTimer(fullscreenTimer.id)}
                >
                  Dismiss timer
                </Button>
              </div>
            </div>

            {sortedTimers.length > 1 ? (
              <div className="cooking-fullscreen-switcher">
                <span className="cooking-fullscreen-switcher-label">
                  All active timers:
                </span>
                <div className="cooking-fullscreen-switcher-list">
                  {sortedTimers.map((item) => (
                    <Button
                      key={item.id}
                      variant={
                        item.id === fullscreenTimer.id ? "primary" : "tonal"
                      }
                      onClick={() => client.openTimerFullscreen(item.id)}
                    >
                      {`${item.label} · ${formatTimerClockValue(item)}`}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </TimersDrawerContext.Provider>
  );
}

function TimerIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 1.5" />
      <path d="M9 2h6" />
      <path d="M12 2v3" />
    </svg>
  );
}

// Re-export formatTimerSeconds so callers can format step timer defs seamlessly
export { formatTimerSeconds };
