import type { RecipeFacts as RecipeFactsModel } from "@cookbook/shared";
import { type ReactNode } from "react";

import {
  FACTS_DASH,
  factsAccessibleSummary,
  formatEffort,
  formatMealTypes,
  formatTotalMinutes,
  effortExplanation,
  mealsExplanation,
  proteinExplanation,
  proteinIconKind,
  timeExplanation,
  type ProteinIconKind,
} from "./facts";

export function RecipeFacts({
  facts,
  explanations,
}: {
  facts: RecipeFactsModel;
  explanations: "hover" | "focusable";
}) {
  const proteinValue = facts.primaryProtein ?? FACTS_DASH;
  const timeValue =
    facts.totalMinutes === null ? FACTS_DASH : formatTotalMinutes(facts.totalMinutes);
  const effortValue = facts.effort ? formatEffort(facts.effort) : FACTS_DASH;
  const mealsValue =
    facts.mealTypes.length === 0 ? FACTS_DASH : formatMealTypes(facts.mealTypes);

  return (
    <span
      className="ui-facts"
      role="group"
      aria-label={
        explanations === "hover" ? factsAccessibleSummary(facts) : "Recipe facts"
      }
    >
      <FactSlot
        explanations={explanations}
        explain={proteinExplanation(facts.primaryProtein)}
        icon={<ProteinIcon kind={proteinIconKind(facts.primaryProtein)} />}
        value={proteinValue}
      />
      <FactSlot
        explanations={explanations}
        explain={timeExplanation(facts.totalMinutes)}
        icon={<ClockIcon />}
        value={timeValue}
      />
      <FactSlot
        explanations={explanations}
        explain={effortExplanation(facts.effort)}
        icon={<EffortIcon />}
        value={effortValue}
      />
      <FactSlot
        explanations={explanations}
        explain={mealsExplanation(facts.mealTypes)}
        icon={<MealIcon />}
        value={mealsValue}
      />
    </span>
  );
}

function FactSlot({
  explanations,
  explain,
  icon,
  value,
}: {
  explanations: "hover" | "focusable";
  explain: string;
  icon: ReactNode;
  value: string;
}) {
  const body = (
    <>
      <span className="ui-facts-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="ui-facts-value">{value}</span>
      <span className="ui-facts-explain" role="tooltip">
        {explain}
      </span>
    </>
  );
  if (explanations === "focusable") {
    return (
      <button type="button" className="ui-facts-slot" aria-label={explain}>
        {body}
      </button>
    );
  }
  return (
    <span className="ui-facts-slot" aria-hidden="true">
      {body}
    </span>
  );
}

function svg(children: ReactNode) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ProteinIcon({ kind }: { kind: ProteinIconKind }) {
  if (kind === "chicken") {
    return svg(
      <>
        <path d="M7 14c1-4 4-7 8-7 3 0 5 2 5 5 0 4-3 7-8 7H8" />
        <path d="M7 14c-2 0-3 2-3 3 1 0 3-1 4-2" />
        <circle cx="16" cy="10" r="0.6" fill="currentColor" />
      </>,
    );
  }
  if (kind === "beef") {
    return svg(
      <>
        <ellipse cx="12" cy="14" rx="7" ry="5" />
        <path d="M7 10c0-3 2.5-5 5-5s5 2 5 5" />
        <path d="M8 7 6 4M16 7l2-3" />
      </>,
    );
  }
  if (kind === "pork") {
    return svg(
      <>
        <ellipse cx="12" cy="14" rx="7" ry="5" />
        <circle cx="12" cy="14" r="1.4" />
        <path d="M8 10c0-3 8-3 8 0M7 17h2M15 17h2" />
      </>,
    );
  }
  if (kind === "turkey") {
    return svg(
      <>
        <path d="M12 20c-4-1-7-5-7-9 4 0 7 3 7 7 0-4 3-7 7-7 0 4-3 8-7 9" />
        <path d="M12 11V7" />
        <circle cx="12" cy="6" r="1.2" />
      </>,
    );
  }
  if (kind === "fish") {
    return svg(
      <>
        <path d="M4 12s4-6 10-6 6 6 6 6-2 6-6 6-10-6-10-6Z" />
        <path d="M20 12h3l-2-3v6Z" />
        <circle cx="8" cy="11" r="0.7" fill="currentColor" />
      </>,
    );
  }
  if (kind === "shellfish") {
    return svg(
      <>
        <path d="M5 15c1-5 5-8 9-8 2 0 4 1 5 3" />
        <path d="M5 15c2 3 6 5 10 4 3-1 4-3 4-5" />
        <path d="M8 15h.1M11 16h.1M14 16h.1" />
      </>,
    );
  }
  if (kind === "eggs") {
    return svg(<ellipse cx="12" cy="13" rx="5" ry="7" />);
  }
  if (kind === "tofu/tempeh") {
    return svg(
      <>
        <rect x="5" y="6" width="14" height="12" rx="1.5" />
        <path d="M5 12h14M12 6v12" />
      </>,
    );
  }
  if (kind === "beans/lentils") {
    return svg(
      <>
        <ellipse cx="9" cy="14" rx="3" ry="4" />
        <ellipse cx="15" cy="11" rx="3" ry="4" />
      </>,
    );
  }
  if (kind === "dairy") {
    return svg(
      <>
        <path d="M8 8h8l1 12H7L8 8Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </>,
    );
  }
  return svg(
    <>
      <path d="M4 14c2-5 6-8 10-8s6 2 6 5c0 5-4 9-10 9-3 0-5-2-6-6Z" />
      <path d="M8 12h.1" />
    </>,
  );
}

function ClockIcon() {
  return svg(
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </>,
  );
}

function EffortIcon() {
  return svg(
    <>
      <rect x="7" y="6" width="10" height="14" rx="2" />
      <path d="M10 6V4h4v2M9 10h6M9 14h6" />
    </>,
  );
}

function MealIcon() {
  return svg(
    <>
      <circle cx="12" cy="13" r="7" />
      <path d="M8 10v.01M12 9v.01M16 10v.01" />
    </>,
  );
}
