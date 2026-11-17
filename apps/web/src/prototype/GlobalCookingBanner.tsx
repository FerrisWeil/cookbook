import { Button } from "@cookbook/ui";
import { useEffect, useState } from "react";

import { pushAppPath } from "../navigate";
import { recipePath } from "../route";
import type { PrototypeCookingClient } from "./cookingStore";
import { useTimersDrawer } from "./TimersDrawer";

export function GlobalCookingBanner({
  client,
}: {
  client: PrototypeCookingClient;
}) {
  const [, setTick] = useState(0);
  const [pathname, setPathname] = useState(() =>
    typeof window === "undefined" ? "/" : window.location.pathname,
  );
  const timersDrawer = useTimersDrawer();

  useEffect(() => {
    return client.subscribe(() => setTick((v) => v + 1));
  }, [client]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const syncPath = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", syncPath);
    const origPush = window.history.pushState.bind(window.history);
    const origReplace = window.history.replaceState.bind(window.history);
    window.history.pushState = (...args) => {
      origPush(...args);
      syncPath();
    };
    window.history.replaceState = (...args) => {
      origReplace(...args);
      syncPath();
    };
    return () => {
      window.removeEventListener("popstate", syncPath);
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
    };
  }, []);

  const session = client.view();
  const extras = client.getExtras();
  if (!session || session.status !== "active" || !extras) {
    return null;
  }

  const targetHref = recipePath(session.recipeId);
  if (pathname === targetHref) {
    return null;
  }

  const totalSteps = session.snapshot.steps.length;
  const doneCount = session.completedSteps.length;
  const progress =
    totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0;
  const label = extras.recipeShortTitle ?? extras.recipeTitle;
  const timerCount = client.getTimers().length;

  function returnToRecipe() {
    if (typeof window === "undefined") {
      return;
    }
    pushAppPath(targetHref, window.history, window.location);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  return (
    <div
      className="global-cooking-banner"
      role="region"
      aria-label="Active cooking session"
    >
      <div className="global-cooking-banner-inner">
        <div className="global-cooking-banner-info">
          {extras.recipeImageUrl ? (
            <img
              className="global-cooking-banner-thumb"
              src={extras.recipeImageUrl}
              alt=""
              decoding="async"
            />
          ) : null}
          <div className="global-cooking-banner-copy">
            <span className="global-cooking-banner-title">
              {`Cooking: ${label}`}
            </span>
            <span className="global-cooking-banner-meta">
              {`Step ${session.displayedStep + 1} of ${totalSteps} · ${doneCount}/${totalSteps} done`}
            </span>
          </div>
        </div>

        <div className="global-cooking-banner-progress" aria-hidden="true">
          <div className="cooking-progress-track">
            <div
              className="cooking-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="global-cooking-banner-actions">
          <Button
            variant="tonal"
            onClick={timersDrawer.toggle}
            aria-expanded={timersDrawer.open}
          >
            {`Timers (${timerCount})`}
          </Button>
          <Button variant="primary" onClick={returnToRecipe}>
            Return to cooking
          </Button>
          <Button
            variant="quiet"
            onClick={() => void client.end()}
            aria-label="End cooking session"
          >
            End
          </Button>
        </div>
      </div>
    </div>
  );
}
