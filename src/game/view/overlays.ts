/**
 * Full-screen overlays (win / loss / help). Stateless Phaser factories; the
 * scene toggles visibility based on GameState.status or user input.
 */
import Phaser from 'phaser'
import { textStyle, CANVAS_W, CANVAS_H, TEXT } from './presentation'
import { WORLD_CONSTS } from '../../core/engine/world'
import { worldDisplayManifest } from '../../data/worldDisplayManifest'
import { worldHelpManifest } from '../../data/worldHelpManifest'

/** Create a full-screen end overlay (hidden by default), centered on the canvas. */
function createEndScreen(
  scene: Phaser.Scene,
  title: string,
  titleColor: string,
  subtitle: string,
): Phaser.GameObjects.Container {
  const container = scene.add.container(CANVAS_W / 2, CANVAS_H / 2)
  container.setDepth(1000)
  container.setVisible(false)

  const bg = scene.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x000000, 0.8)
  container.add(bg)

  const text = scene.add.text(0, -30, title, textStyle({
    fontSize: '72px',
    color: titleColor,
    fontStyle: 'bold',
  }))
  text.setOrigin(0.5, 0.5)
  container.add(text)

  const sub = scene.add.text(0, 50, subtitle, textStyle({
    fontSize: '20px',
    color: '#9aa3b2',
  }))
  sub.setOrigin(0.5, 0.5)
  container.add(sub)

  return container
}

/** Create a full-screen win overlay (hidden by default). */
export function createWinScreen(scene: Phaser.Scene): Phaser.GameObjects.Container {
  return createEndScreen(scene, 'YOU WIN', '#88ee88', 'You survived.')
}

/** Create a full-screen loss overlay (hidden by default). */
export function createLossScreen(scene: Phaser.Scene): Phaser.GameObjects.Container {
  return createEndScreen(scene, 'YOU LOSE', '#ff8888', 'You did not survive meeting the Walker.')
}

// ---------------------------------------------------------------------------
// Help overlay
// ---------------------------------------------------------------------------

/**
 * Create a full-screen help overlay (hidden by default). Covers core rules,
 * keyword definitions, and world-specific mechanic notes.
 *
 * Throws if `worldId` has no entry in worldHelpManifest or worldDisplayManifest.
 */
export function createHelpOverlay(
  scene: Phaser.Scene,
  worldId: string,
  totalActs: number,
): Phaser.GameObjects.Container {
  const container = scene.add.container(CANVAS_W / 2, CANVAS_H / 2)
  container.setDepth(1000)
  container.setVisible(false)

  const bg = scene.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x080a12, 0.92)
  bg.setInteractive()
  container.add(bg)

  const helpData = worldHelpManifest[worldId]
  if (helpData === undefined) {
    throw new Error(`No help entry for worldId: ${worldId}`)
  }
  const displayData = worldDisplayManifest[worldId]
  if (displayData === undefined) {
    throw new Error(`No display entry for worldId: ${worldId}`)
  }

  // ---------------------------------------------------------------------------
  // Section 1 — HOW IT WORKS
  // ---------------------------------------------------------------------------

  const howHeader = scene.add.text(-380, -235, 'HOW IT WORKS', textStyle({
    fontSize: '11px',
    color: TEXT.textKeyword,
    fontStyle: 'uppercase',
  }))
  container.add(howHeader)

  const howContent = scene.add.text(
    -380,
    -218,
    `HP: ${WORLD_CONSTS.startHp}  ·  Energy: +1 per turn  ·  Hand: ${WORLD_CONSTS.maxHandSize} cards  ·  Acts: ${totalActs}`,
    textStyle({ fontSize: '13px', color: TEXT.textMuted }),
  )
  container.add(howContent)

  // ---------------------------------------------------------------------------
  // Section 2 — KEYWORDS (two-column layout)
  // ---------------------------------------------------------------------------

  // Section header y advances from after the HOW IT WORKS block.
  const keywordsHeaderY = -195

  const kwHeader = scene.add.text(-380, keywordsHeaderY, 'KEYWORDS', textStyle({
    fontSize: '11px',
    color: TEXT.textKeyword,
    fontStyle: 'uppercase',
  }))
  container.add(kwHeader)

  const ROW_GAP = 6
  const SECTION_GAP = 16
  const COL_WRAP = 380

  const leftColX = -380
  const rightColX = 10

  const leftEntries = [
    {
      name: 'Energy',
      definition: 'Resource earned at the start of each turn (+1). Spent to play cards with an energy cost. Some cards grant additional energy mid-turn.',
    },
    {
      name: 'Progress',
      definition: 'Damage accumulated on a hazard. When progress equals or exceeds the hazard\'s cost, the hazard is cleared and its reward fires.',
    },
    {
      name: 'Hazard',
      definition: 'A world card dealt into your hand. Three things can happen to it: Clear it by filling the progress ring (fires its reward). Discard it voluntarily (fires its discard effect — may cost HP, add bad cards, or occasionally help). Or survive the turn with it still in hand (fires its end-of-turn effect, usually a penalty).',
    },
    {
      name: 'Hidden',
      definition: 'Keyword on a hazard. Cards like Explore and Listen deal bonus progress against Hidden hazards.',
    },
  ]

  const rightEntries = [
    {
      name: 'Creature',
      definition: 'Keyword on a hazard. Cards like Baseball Bat and Fire Axe deal bonus progress against Creature hazards.',
    },
    {
      name: 'Slow',
      definition: 'Keyword on a hazard. Sprint\'s movement branch deals bonus progress against Slow hazards.',
    },
    {
      name: 'ForceDestroy',
      definition: 'Queues one random player card to be permanently destroyed from your next hand. Multiple charges stack.',
    },
  ]

  let leftY = keywordsHeaderY + kwHeader.height + ROW_GAP
  let rightY = leftY

  for (const entry of leftEntries) {
    const nameText = scene.add.text(
      leftColX, leftY, entry.name,
      textStyle({ fontSize: '13px', color: TEXT.textKeyword, fontStyle: 'bold' }),
    )
    container.add(nameText)
    const defText = scene.add.text(
      leftColX, leftY + nameText.height + 2, entry.definition,
      textStyle({ fontSize: '12px', color: TEXT.textMuted, wordWrap: { width: COL_WRAP } }),
    )
    container.add(defText)
    leftY += nameText.height + 2 + defText.height + ROW_GAP
  }

  for (const entry of rightEntries) {
    const nameText = scene.add.text(
      rightColX, rightY, entry.name,
      textStyle({ fontSize: '13px', color: TEXT.textKeyword, fontStyle: 'bold' }),
    )
    container.add(nameText)
    const defText = scene.add.text(
      rightColX, rightY + nameText.height + 2, entry.definition,
      textStyle({ fontSize: '12px', color: TEXT.textMuted, wordWrap: { width: COL_WRAP } }),
    )
    container.add(defText)
    rightY += nameText.height + 2 + defText.height + ROW_GAP
  }

  // ---------------------------------------------------------------------------
  // Section 3 — IN THIS WORLD
  // ---------------------------------------------------------------------------

  let worldY = Math.max(leftY, rightY) + SECTION_GAP

  const worldHeader = scene.add.text(
    -380,
    worldY,
    `IN THIS WORLD — ${displayData.name}`,
    textStyle({ fontSize: '11px', color: TEXT.textKeyword, fontStyle: 'uppercase' }),
  )
  container.add(worldHeader)
  worldY += worldHeader.height + ROW_GAP

  for (const note of helpData.mechanics) {
    const titleText = scene.add.text(-380, worldY, note.title, textStyle({
      fontSize: '13px',
      color: TEXT.textKeyword,
      fontStyle: 'bold',
    }))
    container.add(titleText)
    worldY += titleText.height + 4

    const detailText = scene.add.text(-380, worldY, note.detail, textStyle({
      fontSize: '13px',
      color: TEXT.textMuted,
      wordWrap: { width: 750 },
    }))
    container.add(detailText)
    worldY += detailText.height + SECTION_GAP
  }

  // ---------------------------------------------------------------------------
  // Dismiss button
  // ---------------------------------------------------------------------------

  const closeBtn = scene.add.text(380, -265, '×', textStyle({
    fontSize: '20px',
    color: TEXT.textLight,
  }))
  closeBtn.setInteractive({ useHandCursor: true })
  closeBtn.on('pointerup', () => container.setVisible(false))
  container.add(closeBtn)

  return container
}
