import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Structural guard (REQ-FEEDBACK-11): the live-play feedback feature is
// renderer-only. Nothing it adds may cross into the pure core. This test reads
// source files off disk and asserts the boundary the whole plan respects.
//
// NOTE: the complementary check "git diff --stat src/core is empty across the
// whole feature" is a CLI gate run in the final validation step (S12). It is
// not expressible as a unit test (a test sees only the current tree, not the
// feature's diff against its base), so it lives in S12, not here.
// ---------------------------------------------------------------------------

// import.meta.dir resolves to src/game/tests; climb to src/, then into core/.
const SRC_DIR = join(import.meta.dir, '..', '..')
const CORE_DIR = join(SRC_DIR, 'core')

/** Every .ts file under `dir`, recursing into subdirectories. */
function collectTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full))
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(full)
    }
  }
  return out
}

/**
 * The `from '...'` / `import '...'` module specifiers in a source file. We only
 * need the quoted specifier, so a single regex over the whole file is enough to
 * catch static `import ... from 'x'`, side-effect `import 'x'`, and re-exports
 * `export ... from 'x'` without depending on line numbers.
 */
function importSpecifiers(source: string): string[] {
  const specs: string[] = []
  const re = /(?:from|import)\s*['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = re.exec(source)) !== null) {
    const spec = match[1]
    if (spec !== undefined) specs.push(spec)
  }
  return specs
}

/**
 * True if a module specifier (from a file *inside* src/core) reaches the
 * renderer side, src/game. A core file can only reach the renderer by escaping
 * its own directory: `../game`, `../../game`, …, or an explicit `src/game`
 * path. A same-directory `./game` is core-internal (src/core/game.ts) and is
 * NOT a leak — matching it would be a false positive.
 */
function pointsAtGame(spec: string): boolean {
  return /^(?:\.\.\/)+game(?:\/|$)/.test(spec) || spec.includes('src/game')
}

/** True if a module specifier is Phaser (the bare package or a subpath). */
function pointsAtPhaser(spec: string): boolean {
  return spec === 'phaser' || spec.startsWith('phaser/')
}

// ---------------------------------------------------------------------------
// 1. No core -> game / core -> phaser leak.
// ---------------------------------------------------------------------------

describe('core boundary: src/core imports neither src/game nor phaser', () => {
  const coreFiles = collectTsFiles(CORE_DIR)

  it('finds core source files to check (guards an empty/misdirected glob)', () => {
    expect(coreFiles.length).toBeGreaterThan(0)
  })

  for (const file of coreFiles) {
    const rel = file.slice(SRC_DIR.length + 1)
    it(`${rel} imports no src/game module and no phaser`, () => {
      const specs = importSpecifiers(readFileSync(file, 'utf8'))
      const gameLeaks = specs.filter(pointsAtGame)
      const phaserLeaks = specs.filter(pointsAtPhaser)
      expect(
        gameLeaks,
        `${rel} must not import from src/game (renderer side); found: ${gameLeaks.join(', ')}`,
      ).toEqual([])
      expect(
        phaserLeaks,
        `${rel} must not import phaser; the core is zero-Phaser. found: ${phaserLeaks.join(', ')}`,
      ).toEqual([])
    })
  }
})

// ---------------------------------------------------------------------------
// 2. feedback.ts is type-only against core, and never imports Phaser.
// ---------------------------------------------------------------------------

describe('feedback.ts: type-only core dependency, no Phaser', () => {
  const FEEDBACK = join(import.meta.dir, '..', 'interaction', 'feedback.ts')
  const source = readFileSync(FEEDBACK, 'utf8')
  const specs = importSpecifiers(source)

  it('imports nothing from phaser', () => {
    const phaserLeaks = specs.filter(pointsAtPhaser)
    expect(
      phaserLeaks,
      `feedback.ts must stay on the pure side; found phaser import(s): ${phaserLeaks.join(', ')}`,
    ).toEqual([])
  })

  it('imports from ../core only via `import type` (no value import)', () => {
    // Every import statement that pulls from a ../core path must be `import type`.
    // A value import of core runtime from this module would couple the pure
    // feedback math to core internals at runtime, which the boundary forbids.
    const coreImportStmt = /import\s+(type\s+)?[^;]*?from\s*['"]((?:\.\.\/)+core[^'"]*)['"]/g
    const valueCoreImports: string[] = []
    let foundAnyCoreImport = false
    let match: RegExpExecArray | null
    while ((match = coreImportStmt.exec(source)) !== null) {
      foundAnyCoreImport = true
      const isTypeOnly = match[1] !== undefined
      const coreSpec = match[2]
      if (!isTypeOnly && coreSpec !== undefined) valueCoreImports.push(coreSpec)
    }
    expect(foundAnyCoreImport, 'feedback.ts is expected to import core types').toBe(true)
    expect(
      valueCoreImports,
      `feedback.ts must import core via \`import type\` only; found value import(s): ${valueCoreImports.join(', ')}`,
    ).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 3. No renderer-feedback identifiers leaked into src/core/types.ts.
//    These tokens are renderer concepts; their presence in core/types would
//    mean the feedback feature crossed the boundary into the core surface.
// ---------------------------------------------------------------------------

describe('core/types.ts: no renderer-feedback tokens leaked into core surface', () => {
  const TYPES = join(CORE_DIR, 'model', 'types.ts')
  const source = readFileSync(TYPES, 'utf8')
  const FORBIDDEN = ['ringFraction', 'connector', 'targetGlow', 'ConnectorStyle', 'committedTarget']

  for (const token of FORBIDDEN) {
    it(`does not contain the renderer token "${token}"`, () => {
      expect(
        source.includes(token),
        `src/core/types.ts must not contain "${token}" — it is a renderer-only feedback concept; ` +
          `its presence means feedback leaked into the core surface.`,
      ).toBe(false)
    })
  }
})
