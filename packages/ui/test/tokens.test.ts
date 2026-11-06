import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { verifies } from "@cookbook/test";

const root = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(join(root, "../src/tokens.css"), "utf8");
const components = readFileSync(join(root, "../src/components.css"), "utf8");

function hexChannel(hex: string, index: number): number {
  return parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
}

function linearize(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const r = linearize(hexChannel(hex, 0));
  const g = linearize(hexChannel(hex, 1));
  const b = linearize(hexChannel(hex, 2));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

function firstHex(name: string, source: string): string {
  const match = source.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(match?.[1], name);
  return match[1];
}

const light = tokens.split(":root[data-theme=\"dark\"]")[0] ?? tokens;

describe("tokens", () => {
  it(
    "keeps theme text readable on its background",
    verifies("148", "b5349828263d5b4a", () => {
      const bg = firstHex("--bg", light);
      const elevated = firstHex("--bg-elevated", light);
      const text = firstHex("--text", light);
      const muted = firstHex("--text-muted", light);
      const accent = firstHex("--accent", light);
      const accentContrast = firstHex("--accent-contrast", light);
      const danger = firstHex("--danger", light);
      const dangerBg = firstHex("--danger-bg", light);
      const darkBlock = tokens.split(":root[data-theme=\"dark\"]")[1] ?? "";
      const darkBg = firstHex("--bg", darkBlock);
      const darkElevated = firstHex("--bg-elevated", darkBlock);
      const darkText = firstHex("--text", darkBlock);
      const darkMuted = firstHex("--text-muted", darkBlock);
      const darkAccent = firstHex("--accent", darkBlock);
      const darkAccentContrast = firstHex("--accent-contrast", darkBlock);
      const darkDanger = firstHex("--danger", darkBlock);
      const darkDangerBg = firstHex("--danger-bg", darkBlock);

      for (const [pair, actual] of [
        [contrast(text, bg), 13.61],
        [contrast(muted, bg), 6.7],
        [contrast(muted, elevated), 6.09],
        [contrast(accent, bg), 6.83],
        [contrast(accent, elevated), 6.2],
        [contrast(accentContrast, accent), 6.83],
        [contrast(danger, dangerBg), 5.89],
        [contrast(danger, bg), 6.82],
        [contrast(darkText, darkBg), 14.9],
        [contrast(darkText, darkElevated), 12.92],
        [contrast(darkMuted, darkBg), 8.96],
        [contrast(darkMuted, darkElevated), 7.77],
        [contrast(darkAccent, darkBg), 11.3],
        [contrast(darkAccentContrast, darkAccent), 11.3],
        [contrast(darkDanger, darkBg), 10.92],
        [contrast(darkDanger, darkDangerBg), 8.6],
      ] as const) {
        assert.ok(pair >= 4.5, String(pair));
        assert.ok(Math.abs(pair - actual) < 0.05, `${pair} ${actual}`);
      }
    }),
  );

  it(
    "keeps control boundaries readable on their background",
    verifies("149", "8cc3676112d49172", () => {
      const bg = firstHex("--bg", light);
      const elevated = firstHex("--bg-elevated", light);
      const border = firstHex("--border", light);
      const darkBlock = tokens.split(":root[data-theme=\"dark\"]")[1] ?? "";
      const darkBg = firstHex("--bg", darkBlock);
      const darkElevated = firstHex("--bg-elevated", darkBlock);
      const darkBorder = firstHex("--border", darkBlock);
      const pairs = [
        [contrast(border, bg), 4.18],
        [contrast(border, elevated), 3.8],
        [contrast(darkBorder, darkBg), 4.36],
        [contrast(darkBorder, darkElevated), 3.78],
      ] as const;
      for (const [pair, actual] of pairs) {
        assert.ok(pair >= 3, String(pair));
        assert.ok(Math.abs(pair - actual) < 0.05, `${pair} ${actual}`);
      }
    }),
  );

  it(
    "sizes primary actions at least 44 by 44 CSS pixels",
    verifies("54", "ac2dc4173fce5d98", () => {
      assert.match(tokens, /--hit:\s*2\.75rem;/);
      assert.match(components, /min-height:\s*var\(--hit\)/);
      assert.match(components, /min-width:\s*var\(--hit\)/);
      assert.match(components, /\.ui-button\s*\{[\s\S]*min-height:\s*var\(--hit\)/);
    }),
  );
});
