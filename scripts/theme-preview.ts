#!/usr/bin/env bun
// Renders a swatch sheet for a world's theme.ts so its palette can be seen at a
// glance instead of read as hex strings. Requires `magick` (ImageMagick) on PATH.
//
// Usage: bun run scripts/theme-preview.ts <world-id> [output.png]
//   bun run scripts/theme-preview.ts eden-prime
//   bun run scripts/theme-preview.ts all               # one sheet per world

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const WORLDS_DIR = join(import.meta.dir, "..", "src", "data", "worlds");
const OUT_DIR = join(import.meta.dir, "..", "tmp", "theme-preview");

interface Swatch {
  label: string;
  hex: string; // "#rrggbb"
}

interface Section {
  title: string;
  swatches: Swatch[];
}

function toHex(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") return "#" + value.toString(16).padStart(6, "0");
  return value;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function contrastColor(hex: string): string {
  return luminance(hex) > 0.55 ? "#000000" : "#ffffff";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadTheme(worldId: string): Promise<any> {
  const modulePath = join(WORLDS_DIR, worldId, "theme.ts");
  const file = Bun.file(modulePath);
  if (!(await file.exists())) {
    throw new Error(`No theme.ts found for world "${worldId}" (looked in ${modulePath})`);
  }
  const module = await import(modulePath);
  const exported = Object.values(module)[0];
  if (!exported) {
    throw new Error(`theme.ts for "${worldId}" has no exported theme object`);
  }
  return exported;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSections(theme: any): Section[] {
  const sections: Section[] = [];

  const core: Swatch[] = [];
  const intrusionHex = toHex(theme.intrusionHue);
  if (intrusionHex) core.push({ label: "intrusionHue", hex: intrusionHex });
  const doorGlowHex = toHex(theme.doorGlowTint);
  if (doorGlowHex) core.push({ label: "doorGlowTint", hex: doorGlowHex });
  const doorHex = toHex(theme.doorTint);
  if (doorHex) core.push({ label: "doorTint", hex: doorHex });
  if (core.length) sections.push({ title: "Core", swatches: core });

  if (theme.realityPalette) {
    sections.push({
      title: "Reality Palette",
      swatches: Object.entries(theme.realityPalette).map(([label, value]) => ({
        label,
        hex: toHex(value as string) as string,
      })),
    });
  }

  if (theme.frameStyle) {
    sections.push({
      title: "Frame Style",
      swatches: Object.entries(theme.frameStyle).map(([label, value]) => ({
        label,
        hex: toHex(value as number) as string,
      })),
    });
  }

  return sections;
}

const TILE_W = 240;
const TILE_H = 130;
const SWATCH_H = 90;
const COLS = 4;
const MARGIN = 20;
const SECTION_GAP = 30;
const TITLE_H = 34;

function renderSheet(worldId: string, sections: Section[]): string[] {
  let height = MARGIN;
  for (const section of sections) {
    const rows = Math.ceil(section.swatches.length / COLS);
    height += TITLE_H + rows * TILE_H + SECTION_GAP;
  }
  height += MARGIN;
  const width = MARGIN * 2 + COLS * TILE_W;

  const args: string[] = ["-size", `${width}x${height}`, "xc:#1e1e1e"];
  args.push("-gravity", "NorthWest");
  args.push("-font", "Adwaita-Sans");

  let y = MARGIN;
  args.push(
    "-fill",
    "#ffffff",
    "-pointsize",
    "24",
    "-draw",
    `text ${MARGIN},${y + 20} '${worldId}'`,
  );
  y += 40;

  for (const section of sections) {
    args.push(
      "-fill",
      "#aaaaaa",
      "-pointsize",
      "16",
      "-draw",
      `text ${MARGIN},${y + TITLE_H - 10} '${section.title}'`,
    );
    y += TITLE_H;

    section.swatches.forEach((swatch, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x0 = MARGIN + col * TILE_W;
      const y0 = y + row * TILE_H;
      const x1 = x0 + TILE_W - 10;
      const y1 = y0 + SWATCH_H;

      args.push("-fill", swatch.hex, "-draw", `rectangle ${x0},${y0} ${x1},${y1}`);

      const textColor = contrastColor(swatch.hex);
      args.push(
        "-fill",
        textColor,
        "-pointsize",
        "14",
        "-draw",
        `text ${x0 + 8},${y0 + SWATCH_H - 10} '${swatch.hex}'`,
      );

      args.push(
        "-fill",
        "#dddddd",
        "-pointsize",
        "13",
        "-draw",
        `text ${x0},${y1 + 16} '${swatch.label}'`,
      );
    });

    const rows = Math.ceil(section.swatches.length / COLS);
    y += rows * TILE_H + SECTION_GAP;
  }

  return args;
}

async function renderWorld(worldId: string, outputPath?: string): Promise<string> {
  const theme = await loadTheme(worldId);
  const sections = buildSections(theme);
  const args = renderSheet(worldId, sections);

  await mkdir(OUT_DIR, { recursive: true });
  const dest = outputPath ?? join(OUT_DIR, `${worldId}.png`);

  const proc = Bun.spawnSync(["magick", ...args, dest]);
  if (proc.exitCode !== 0) {
    throw new Error(`magick failed for "${worldId}": ${proc.stderr.toString()}`);
  }
  return dest;
}

async function main() {
  const [worldId, outputArg] = process.argv.slice(2);
  if (!worldId) {
    console.error("Usage: bun run scripts/theme-preview.ts <world-id|all> [output.png]");
    process.exit(1);
  }

  if (worldId === "all") {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(WORLDS_DIR, { withFileTypes: true });
    const worldIds = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    for (const id of worldIds) {
      const dest = await renderWorld(id);
      console.log(`${id} -> ${dest}`);
    }
    return;
  }

  const dest = await renderWorld(worldId, outputArg);
  console.log(dest);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
