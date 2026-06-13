/**
 * Tests for the pure half of the token-row effect renderer.
 *
 * Every function under test decides HOW a compiled effect line looks and
 * returns plain data — none constructs a Phaser object, so these run headless
 * (the same property presentation.test.ts protects). The Phaser apply layer
 * (effectLineView.ts) is deliberately untested here: the codebase has no
 * harness for instantiating real Phaser scenes, and we do not invent one.
 */
import { describe, it, expect } from "bun:test";
import type { EffectLine, IconId } from "../../core/view/effectGlyphs";
import { TEXT } from "../view/presentation";
import {
  EFFECT_ICON_PLACEHOLDERS,
  EFFECT_ICON_TEXTURES,
  availableWidthFor,
  effectLineStyles,
  fitRowScale,
  layoutRowTokens,
  lineHeightOf,
  lineWarningText,
  normalizeTokenText,
  riderFontSize,
  stackLines,
  valueTokenStyle,
  withLeadIcon,
  type EffectLineGeometry,
} from "../view/effectLineLayout";

// Every IconId, kept in sync by the compiler: assigning this array to
// Record keys below fails to compile when core grows the union.
const ALL_ICON_IDS: IconId[] = [
  "progress",
  "progressAll",
  "draw",
  "worldDraw",
  "hp",
  "energy",
  "discard",
  "destroy",
  "exile",
  "return",
  "addCard",
  "brace",
  "survive",
  "vanish",
  "eachTurn",
  "onDiscard",
  "onClear",
  "onPartialClear",
];

// ---------------------------------------------------------------------------
// Texture map + placeholders
// ---------------------------------------------------------------------------

describe("EFFECT_ICON_TEXTURES", () => {
  it("maps every IconId to a non-empty texture key", () => {
    for (const id of ALL_ICON_IDS) {
      expect(EFFECT_ICON_TEXTURES[id].length).toBeGreaterThan(0);
    }
    expect(Object.keys(EFFECT_ICON_TEXTURES).sort()).toEqual([...ALL_ICON_IDS].sort());
  });

  it("uses a unique texture key per icon", () => {
    const keys = Object.values(EFFECT_ICON_TEXTURES);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("EFFECT_ICON_PLACEHOLDERS", () => {
  it("gives every icon a single-character letter", () => {
    for (const id of ALL_ICON_IDS) {
      expect(EFFECT_ICON_PLACEHOLDERS[id].letter.length).toBe(1);
    }
  });

  it("gives every icon a distinct hue", () => {
    const colors = Object.values(EFFECT_ICON_PLACEHOLDERS).map((spec) => spec.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("uses valid #rrggbb colours", () => {
    for (const { color } of Object.values(EFFECT_ICON_PLACEHOLDERS)) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Role styling
// ---------------------------------------------------------------------------

const GEOMETRY: EffectLineGeometry = {
  baseFontSize: 11,
  riderFontSize: 9,
  branchIndent: 10,
  hangIndent: 0,
};

function line(role?: EffectLine["role"]): EffectLine {
  const tokens: EffectLine["tokens"] = [{ kind: "text", text: "x" }];
  return role === undefined ? { tokens } : { tokens, role };
}

describe("effectLineStyles", () => {
  it("renders main (and undefined-role) lines at base size with no indent", () => {
    const styles = effectLineStyles([line(), line("main")], GEOMETRY);
    expect(styles).toEqual([
      { fontSize: 11, indent: 0 },
      { fontSize: 11, indent: 0 },
    ]);
  });

  it("indents branch lines at base size", () => {
    const styles = effectLineStyles([line(), line("branch")], GEOMETRY);
    expect(styles[1]).toEqual({ fontSize: 11, indent: 10 });
  });

  it("renders a rider smaller, at the indent of the preceding main line", () => {
    const styles = effectLineStyles([line(), line("rider")], GEOMETRY);
    expect(styles[1]).toEqual({ fontSize: 9, indent: 0 });
  });

  it("indents a rider after a branch with that branch", () => {
    const styles = effectLineStyles([line(), line("branch"), line("rider")], GEOMETRY);
    expect(styles[2]).toEqual({ fontSize: 9, indent: 10 });
  });

  it("binds consecutive riders to the same owning line", () => {
    const styles = effectLineStyles([line("branch"), line("rider"), line("rider")], GEOMETRY);
    expect(styles[1]?.indent).toBe(styles[0]?.indent ?? -1);
    expect(styles[2]?.indent).toBe(styles[0]?.indent ?? -1);
  });

  it("hangs lines after the first under a leading trigger icon", () => {
    const hanging = { ...GEOMETRY, hangIndent: 12 };
    const styles = effectLineStyles([line(), line(), line("branch"), line("rider")], hanging);
    expect(styles).toEqual([
      { fontSize: 11, indent: 0 }, // first line carries the icon itself
      { fontSize: 11, indent: 12 }, // continuation hangs under it
      { fontSize: 11, indent: 22 }, // branch indent stacks on the hang
      { fontSize: 9, indent: 22 }, // rider copies the branch's full indent
    ]);
  });

  it("hangs a rider bound to the lead-icon line at hangIndent, not 0", () => {
    // The most common world block shape: [lead-icon main, rider] — e.g. a
    // DealProgress with a bonus under an eachTurn trigger. The hang is the
    // FLOOR for every line after the first (design §2), so the rider tucks
    // under the first line's text instead of sitting flush with the icon.
    const hanging = { ...GEOMETRY, hangIndent: 12 };
    const styles = effectLineStyles([line(), line("rider")], hanging);
    expect(styles).toEqual([
      { fontSize: 11, indent: 0 }, // first line carries the icon itself
      { fontSize: 9, indent: 12 }, // rider hangs at the floor
    ]);
  });

  it("keeps hang + branch for a rider bound to a hung branch", () => {
    const hanging = { ...GEOMETRY, hangIndent: 12 };
    const styles = effectLineStyles([line(), line("branch"), line("rider")], hanging);
    expect(styles[2]).toEqual({ fontSize: 9, indent: 22 }); // owner's 12 + 10 beats the 12 floor
  });

  it("defaults a leading rider to indent 0", () => {
    const styles = effectLineStyles([line("rider")], GEOMETRY);
    expect(styles[0]).toEqual({ fontSize: 9, indent: 0 });
  });

  it("returns one style per line", () => {
    expect(effectLineStyles([], GEOMETRY)).toEqual([]);
    expect(effectLineStyles([line(), line("rider"), line()], GEOMETRY).length).toBe(3);
  });
});

describe("riderFontSize", () => {
  it("drops two px from the base size", () => {
    expect(riderFontSize(11)).toBe(9);
    expect(riderFontSize(10)).toBe(8);
  });

  it("never drops below the legibility floor", () => {
    expect(riderFontSize(8)).toBe(7);
    expect(riderFontSize(7)).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Value emphasis
// ---------------------------------------------------------------------------

describe("valueTokenStyle", () => {
  const BASE = "#e8eaf0";

  it("keeps the base colour and adds the cost-coloured glow for progress", () => {
    expect(valueTokenStyle("progress", BASE)).toEqual({ color: BASE, glowColor: 0xffcc44 });
  });

  it("tints reward values", () => {
    expect(valueTokenStyle("reward", BASE)).toEqual({ color: TEXT.textReward });
  });

  it("tints penalty values", () => {
    expect(valueTokenStyle("penalty", BASE)).toEqual({ color: TEXT.textPenalty });
  });

  it("renders unemphasised values in the base colour with no glow", () => {
    const style = valueTokenStyle(undefined, BASE);
    expect(style.color).toBe(BASE);
    expect(style.glowColor).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Row layout
// ---------------------------------------------------------------------------

describe("layoutRowTokens", () => {
  it("lays out widths left-to-right with gaps between neighbours", () => {
    const { rowWidth, centers } = layoutRowTokens([10, 20, 30], 4);
    expect(rowWidth).toBe(10 + 4 + 20 + 4 + 30);
    expect(centers).toEqual([5, 10 + 4 + 10, 10 + 4 + 20 + 4 + 15]);
  });

  it("adds no gap around a single token", () => {
    expect(layoutRowTokens([12], 4)).toEqual({ rowWidth: 12, centers: [6] });
  });

  it("handles an empty row", () => {
    expect(layoutRowTokens([], 4)).toEqual({ rowWidth: 0, centers: [] });
  });
});

describe("fitRowScale", () => {
  it("returns 1 when the row fits", () => {
    expect(fitRowScale(100, 100)).toBe(1);
    expect(fitRowScale(50, 100)).toBe(1);
  });

  it("scales an over-wide row down to the available width", () => {
    expect(fitRowScale(200, 100)).toBe(0.5);
  });

  it("never scales up or below zero", () => {
    expect(fitRowScale(0, 100)).toBe(1);
    expect(fitRowScale(100, -5)).toBe(0);
  });
});

describe("availableWidthFor", () => {
  it("gives an unindented row the full block width", () => {
    expect(availableWidthFor({ fontSize: 11, indent: 0 }, 120)).toBe(120);
  });

  it("charges an indented row its indent on BOTH sides of the centred block", () => {
    expect(availableWidthFor({ fontSize: 9, indent: 10 }, 120)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Vertical stacking
// ---------------------------------------------------------------------------

describe("lineHeightOf", () => {
  it("uses the measured text height when the line has text", () => {
    expect(lineHeightOf(13, 11)).toBe(13);
  });

  it("falls back to a font-derived height for icon-only lines", () => {
    // 11px font × 1.4 iconOnlyHeightFactor = 15.4, rounded to 15.
    expect(lineHeightOf(0, 11)).toBe(15);
  });
});

describe("stackLines", () => {
  it("spaces between lines but not after the last", () => {
    const { centers, height } = stackLines([10, 12, 14], 2);
    expect(height).toBe(10 + 2 + 12 + 2 + 14); // = 40, no trailing spacing
    expect(centers).toEqual([5, 18, 33]); // 10/2, 10+2 + 12/2, 10+2+12+2 + 14/2
  });

  it("gives a single line its own height with no spacing", () => {
    expect(stackLines([16], 2)).toEqual({ centers: [8], height: 16 });
  });

  it("handles an empty block", () => {
    expect(stackLines([], 2)).toEqual({ centers: [], height: 0 });
  });
});

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

describe("withLeadIcon", () => {
  it("prepends the trigger icon to the first line only", () => {
    const lines: EffectLine[] = [
      { tokens: [{ kind: "value", text: "2" }] },
      { tokens: [{ kind: "text", text: "vs Spore" }], role: "rider" },
    ];
    const result = withLeadIcon(lines, "eachTurn");
    expect(result[0]?.tokens).toEqual([
      { kind: "icon", icon: "eachTurn" },
      { kind: "text", text: ":" },
      { kind: "value", text: "2" },
    ]);
    expect(result[1]).toEqual(lines[1] as EffectLine);
  });

  it("returns empty for empty input — a None block never renders a naked trigger", () => {
    expect(withLeadIcon([], "onClear")).toEqual([]);
  });

  it("does not mutate the input lines", () => {
    const lines: EffectLine[] = [{ tokens: [{ kind: "value", text: "2" }] }];
    withLeadIcon(lines, "onDiscard");
    expect(lines[0]?.tokens.length).toBe(1);
  });
});

describe("normalizeTokenText", () => {
  it("flattens U+2212 minus to an ASCII hyphen", () => {
    expect(normalizeTokenText("−2")).toBe("-2");
    expect(normalizeTokenText("−1 per Spore −1")).toBe("-1 per Spore -1");
  });

  it("leaves everything else untouched (en-dash ranges included)", () => {
    expect(normalizeTokenText("1–2")).toBe("1–2");
    expect(normalizeTokenText("+3 vs Slow")).toBe("+3 vs Slow");
  });
});

describe("lineWarningText", () => {
  it("names icons and joins token texts readably", () => {
    const warned = lineWarningText({
      tokens: [
        { kind: "icon", icon: "discard" },
        { kind: "value", text: "1" },
        { kind: "text", text: "then" },
        { kind: "icon", icon: "draw" },
        { kind: "value", text: "2" },
      ],
    });
    expect(warned).toBe("[discard] 1 then [draw] 2");
  });

  it("handles icon-only lines", () => {
    expect(lineWarningText({ tokens: [{ kind: "icon", icon: "vanish" }] })).toBe("[vanish]");
  });
});
