const SEGMENTS_FOR_CHAR: Record<string, readonly boolean[]> = {
  //        a      b      c      d      e      f      g
  "0": [true, true, true, true, true, true, false],
  "1": [false, true, true, false, false, false, false],
  "2": [true, true, false, true, true, false, true],
  "3": [true, true, true, true, false, false, true],
  "4": [false, true, true, false, false, true, true],
  "5": [true, false, true, true, false, true, true],
  "6": [true, false, true, true, true, true, true],
  "7": [true, true, true, false, false, false, false],
  "8": [true, true, true, true, true, true, true],
  "9": [true, true, true, true, false, true, true],
  "-": [false, false, false, false, false, false, true],
};

// Geometric 7-segment polygon coordinates in a 24x40 digit cell
const SEGMENT_POLYGONS: readonly string[] = [
  "4,2 20,2 17,6 7,6", // a (top)
  "21,3 21,18 17,16 17,7", // b (top-right)
  "21,22 21,37 17,33 17,24", // c (bottom-right)
  "4,38 20,38 17,34 7,34", // d (bottom)
  "3,22 7,24 7,33 3,37", // e (bottom-left)
  "3,3 7,7 7,16 3,18", // f (top-left)
  "4,20 7,18 17,18 20,20 17,22 7,22", // g (middle)
];

export type ClockTone = "running" | "warning" | "paused" | "finished";

export function SevenSegmentClock({
  value,
  tone = "running",
  size = "md",
  className,
  ariaLabel,
}: {
  value: string;
  tone?: ClockTone;
  size?: "xs" | "sm" | "md" | "xl";
  className?: string;
  ariaLabel?: string;
}) {
  const tokens = Array.from(value);

  return (
    <span
      className={`seg-clock seg-clock--${tone} seg-clock--${size}${className ? ` ${className}` : ""}`}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      {tokens.map((char, index) => {
        if (char === ":") {
          return (
            <svg
              key={index}
              className="seg-colon"
              viewBox="0 0 10 40"
              aria-hidden="true"
            >
              <circle className="seg-on" cx="5" cy="13" r="2.2" />
              <circle className="seg-on" cx="5" cy="27" r="2.2" />
            </svg>
          );
        }
        if (char === "+") {
          return (
            <svg
              key={index}
              className="seg-plus"
              viewBox="0 0 16 40"
              aria-hidden="true"
            >
              <rect className="seg-on" x="2" y="18.2" width="12" height="3.6" rx="1" />
              <rect className="seg-on" x="6.2" y="14" width="3.6" height="12" rx="1" />
            </svg>
          );
        }
        const active = SEGMENTS_FOR_CHAR[char] ?? SEGMENTS_FOR_CHAR["0"]!;
        return (
          <svg
            key={index}
            className="seg-digit"
            viewBox="0 0 24 40"
            aria-hidden="true"
          >
            {SEGMENT_POLYGONS.map((points, segIdx) => (
              <polygon
                key={segIdx}
                points={points}
                className={active[segIdx] ? "seg-on" : "seg-ghost"}
              />
            ))}
          </svg>
        );
      })}
    </span>
  );
}

export function formatReadyAtClock(endAtMs: number): string {
  try {
    return new Date(endAtMs).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
