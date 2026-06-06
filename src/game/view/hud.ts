/**
 * HUD: a textured backing panel plus the HP / act / draw / world status labels.
 * Stateless Phaser factory + updater — the scene passes GameState to updateHUD.
 */
import Phaser from 'phaser'
import type { GameState } from '../../core/index'
import { TEXT, textStyle } from './presentation'

export interface HUDRefs {
  // The whole HUD (backing panel + every label) lives in this container, so the
  // caller can move the bar as one object via container.setPosition. Child
  // coordinates below are relative to the container origin.
  container: Phaser.GameObjects.Container
  hpText: Phaser.GameObjects.Text
  actText: Phaser.GameObjects.Text
  drawText: Phaser.GameObjects.Text
  worldText: Phaser.GameObjects.Text
}

// HUD backing panel geometry. The text-back texture is a 600×600 grunge frame:
// a thick decorated border around a dark interior. As a nine-slice we keep the
// decorated LEFT/RIGHT edges intact (wide side insets) and sample only a thin
// strip of the TOP/BOTTOM border (small insets), so the dark interior stretches
// to fill the bar behind the text instead of the frame swallowing it. Insets are
// chosen so the interior band (panel top + top inset .. panel bottom − bottom
// inset) brackets the 14px text sitting at y=10.
const HUD_PANEL_X = 30
const HUD_PANEL_Y = 0
const HUD_PANEL_W = 530
const HUD_PANEL_H = 45
const HUD_PANEL_SIDE_INSET = 6 // left/right: keep the decorated vertical frame
const HUD_PANEL_EDGE_INSET = 6 // top/bottom: thin frayed edge, interior shows through

/** Create the HUD: a textured backing panel plus the status text objects. */
export function createHUD(scene: Phaser.Scene): HUDRefs {
  // Everything lives in this container so the bar moves as one object. Default
  // position (0,0) keeps child local coordinates equal to the old absolute ones,
  // so the rendered HUD is unchanged until the caller repositions the container.
  const container = scene.add.container(0, 0)

  // Backing panel, added first so it sits behind every HUD label. A nine-slice
  // (not a stretched image) so the square frame's decorated edges don't distort
  // when scaled to the wide, short HUD strip.
  const panel = scene.add
    .nineslice(
      0,
      0,
      'text-back',
      undefined,
      HUD_PANEL_W,
      HUD_PANEL_H,
      HUD_PANEL_SIDE_INSET,
      HUD_PANEL_SIDE_INSET,
      HUD_PANEL_EDGE_INSET,
      HUD_PANEL_EDGE_INSET,
    )
    .setOrigin(0, 0)
    .setTint(0xBBBBBB)
  container.add(panel)

  // The textured panel supplies the dark backing, so the labels no longer carry
  // their own translucent-black backgroundColor.
  const style = textStyle({ fontSize: '16px', fontStyle: 'bold', color: TEXT.textLight })
  const mutedStyle = textStyle({ fontSize: '14px', color: TEXT.textMuted })

  // Origin (0, 0.5): x is the panel-relative left edge of the label, y is the
  // panel's vertical center, so every label is vertically centered in the bar.
  const hpText = scene.add.text(30, HUD_PANEL_H / 2, 'HP: —', { ...style, color: '#FF8888' })
  const actText = scene.add.text(140, HUD_PANEL_H / 2, 'Act 1', style)
  const drawText = scene.add.text(214, HUD_PANEL_H / 2, 'Draw: — | Discard: —', mutedStyle)
  const worldText = scene.add.text(434, HUD_PANEL_H / 2, 'World: —', mutedStyle)
  for (const label of [hpText, actText, drawText, worldText]) {
    label.setOrigin(0, 0.5)
  }
  container.add([hpText, actText, drawText, worldText])
  container.setPosition(HUD_PANEL_X, HUD_PANEL_Y)

  return { container, hpText, actText, drawText, worldText }
}

/** Update HUD text to match the current GameState. */
export function updateHUD(refs: HUDRefs, state: GameState): void {
  refs.hpText.setText(`HP: ${state.hp}/20`)
  refs.actText.setText(`Act ${state.actIndex + 1}`)
  refs.drawText.setText(`Draw: ${state.playerDraw.length} | Discard: ${state.playerDiscard.length}`)
  const worldPile = state.worldDraw.length
  refs.worldText.setText(`World: ${worldPile}`)
}
