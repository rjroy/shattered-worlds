/**
 * HUD: a textured backing panel plus the HP / act / draw / world status labels.
 * HUDView owns the persistent Phaser objects; the scene passes GameState to
 * update the text values.
 */
import Phaser from "phaser";
import type { GameState } from "../../core/index";
import { TEXT, textStyle } from "./presentation";
import { HUD_LAYOUT } from "./layout";

// HUD backing panel geometry. The text-back texture is a 600×600 grunge frame:
// a thick decorated border around a dark interior. As a nine-slice we keep the
// decorated LEFT/RIGHT edges intact (wide side insets) and sample only a thin
// strip of the TOP/BOTTOM border (small insets), so the dark interior stretches
// to fill the bar behind the text instead of the frame swallowing it. Insets are
// chosen so the interior band (panel top + top inset .. panel bottom − bottom
// inset) brackets the 14px text sitting at y=10.
const HUD_PANEL_X = HUD_LAYOUT.panel.x;
const HUD_PANEL_Y = HUD_LAYOUT.panel.y;
const HUD_PANEL_W = HUD_LAYOUT.panel.width;
const HUD_PANEL_H = HUD_LAYOUT.panel.height;
const HUD_PANEL_SIDE_INSET = HUD_LAYOUT.panel.sideInset; // left/right: keep the decorated vertical frame
const HUD_PANEL_EDGE_INSET = HUD_LAYOUT.panel.edgeInset; // top/bottom: thin frayed edge, interior shows through
const HUD_POWER_UPS = HUD_LAYOUT.powerUps;

interface PowerUpIndicator {
  container: Phaser.GameObjects.Container;
  countText: Phaser.GameObjects.Text;
}

export class HUDView extends Phaser.GameObjects.Container {
  private hpText: Phaser.GameObjects.Text;
  private actText: Phaser.GameObjects.Text;
  private energyText: Phaser.GameObjects.Text;
  private powerUps: Phaser.GameObjects.Container;
  private powerUpIndicators: PowerUpIndicator[] = [];
  private braceIndicator: PowerUpIndicator | undefined;
  private forceDestroyIndicator: PowerUpIndicator | undefined;
  private powerUpPanel: Phaser.GameObjects.NineSlice;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    scene.add.existing(this);

    // Backing panel, added first so it sits behind every HUD label. A nine-slice
    // (not a stretched image) so the square frame's decorated edges don't distort
    // when scaled to the wide, short HUD strip.
    const panel = scene.add
      .nineslice(
        0,
        0,
        "text-back",
        undefined,
        HUD_PANEL_W,
        HUD_PANEL_H,
        HUD_PANEL_SIDE_INSET,
        HUD_PANEL_SIDE_INSET,
        HUD_PANEL_EDGE_INSET,
        HUD_PANEL_EDGE_INSET,
      )
      .setOrigin(0, 0)
      .setTint(0xbbbbbb);
    this.add(panel);

    // The textured panel supplies the dark backing, so the labels no longer carry
    // their own translucent-black backgroundColor.
    const style = textStyle({ fontSize: "16px", fontStyle: "bold", color: TEXT.textLight });

    // Origin (0, 0.5): x is the panel-relative left edge of the label, y is the
    // panel's vertical center, so every label is vertically centered in the bar.
    this.hpText = scene.add.text(HUD_LAYOUT.labels.hpX, HUD_PANEL_H / 2, "HP: —", {
      ...style,
      color: TEXT.textHp,
    });
    this.actText = scene.add.text(HUD_LAYOUT.labels.actX, HUD_PANEL_H / 2, "Act 1 / 3", style);
    this.energyText = scene.add.text(HUD_LAYOUT.labels.energyX, HUD_PANEL_H / 2, "—", {
      ...style,
      color: TEXT.textEnergy,
    });
    this.powerUps = scene.add.container(HUD_LAYOUT.labels.powerUpX, HUD_PANEL_H / 2);
    const energyIcon = scene.add
      .image(this.energyText.x - HUD_LAYOUT.energyIconOffsetX, this.energyText.y, "energy-icon")
      .setDisplaySize(HUD_LAYOUT.energyIconSize, HUD_LAYOUT.energyIconSize);

    for (const label of [this.hpText, this.actText, this.energyText, energyIcon]) {
      label.setOrigin(0, 0.5);
      this.add(label);
    }
    this.add(this.powerUps);
    this.energyText.setAbove(energyIcon);

    this.powerUpPanel = scene.add
      .nineslice(
        0,
        0,
        "text-back",
        undefined,
        HUD_PANEL_W,
        HUD_PANEL_H,
        HUD_PANEL_SIDE_INSET,
        HUD_PANEL_SIDE_INSET,
        HUD_PANEL_EDGE_INSET,
        HUD_PANEL_EDGE_INSET,
      )
      .setOrigin(0, 0)
      .setTint(0xbbbbbb);
    this.powerUps.add(this.powerUpPanel);
    this.powerUpPanel.setVisible(false); // only show the panel when we have at least one power-up to list
    this.add(panel);

    this.setPosition(HUD_PANEL_X, HUD_PANEL_Y);
  }

  /** Update HUD text to match the current GameState. */
  update(state: GameState): void {
    this.hpText.setText(`HP: ${state.hp}`);
    this.actText.setText(`Act ${state.actIndex + 1} / ${state.totalActs}`);
    this.energyText.setText(`${state.energy}`);
    if (state.braceCharges > 0) {
      if (this.braceIndicator === undefined) {
        this.braceIndicator = this.addPowerUp("effect-icon-brace");
      }
      this.setPowerUpValue(this.braceIndicator, state.braceCharges);
    } else {
      if (this.braceIndicator !== undefined) {
        this.braceIndicator.container.setVisible(false);
      }
    }
    if (state.pendingForceDestroy > 0) {
      if (this.forceDestroyIndicator === undefined) {
        this.forceDestroyIndicator = this.addPowerUp("effect-icon-destroy");
      }
      this.setPowerUpValue(this.forceDestroyIndicator, state.pendingForceDestroy);
    } else {
      if (this.forceDestroyIndicator !== undefined) {
        this.forceDestroyIndicator.container.setVisible(false);
      }
    }
    let minX: number | undefined = undefined;
    let maxX: number | undefined = undefined;
    let hasPowerUps: boolean = false;
    let nextX = 0;
    for (const indicator of this.powerUpIndicators) {
      if (indicator.container.visible) {
        hasPowerUps = true;
        indicator.container.setPosition(nextX, 0);
        const indicatorWidth = this.powerUpWidth(indicator);
        if (minX === undefined || indicator.container.x < minX) {
          minX = indicator.container.x;
        }
        if (maxX === undefined || indicator.container.x + indicatorWidth > maxX) {
          maxX = indicator.container.x + indicatorWidth;
        }
        nextX += indicatorWidth + HUD_POWER_UPS.itemGap;
      }
    }
    this.powerUps.setVisible(hasPowerUps);
    this.powerUpPanel.setVisible(hasPowerUps);
    if (minX !== undefined && maxX !== undefined) {
      this.powerUpPanel.setPosition(minX - HUD_POWER_UPS.panelPadX, -HUD_PANEL_H / 2);
      this.powerUpPanel.setSize(maxX - minX + HUD_POWER_UPS.panelPadX * 2, HUD_PANEL_H);
    }
  }

  private addPowerUp(texture: string): PowerUpIndicator {
    const style = textStyle({ fontSize: "16px", fontStyle: "bold", color: TEXT.textLight });
    const container = this.scene.add.container(0, 0);
    const icon = this.scene.add
      .image(0, 0, texture)
      .setDisplaySize(HUD_POWER_UPS.iconSize, HUD_POWER_UPS.iconSize);
    const countText = this.scene.add.text(
      HUD_POWER_UPS.iconSize + HUD_POWER_UPS.countGap,
      0,
      "",
      style,
    );

    icon.setOrigin(0, 0.5);
    countText.setOrigin(0, 0.5);
    container.add([icon, countText]);
    this.powerUps.add(container);

    const indicator = { container, countText };
    this.powerUpIndicators.push(indicator);
    return indicator;
  }

  private setPowerUpValue(indicator: PowerUpIndicator, value: number): void {
    indicator.container.setVisible(true);
    indicator.countText.setText(`${value}`);
  }

  private powerUpWidth(indicator: PowerUpIndicator): number {
    return HUD_POWER_UPS.iconSize + HUD_POWER_UPS.countGap + indicator.countText.width;
  }
}
