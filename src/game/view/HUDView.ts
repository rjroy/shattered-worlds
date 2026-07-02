/**
 * HUD: a textured backing panel plus the HP / act / draw / world status labels.
 * HUDView owns the persistent Phaser objects; the scene passes GameState to
 * update the text values.
 */
import Phaser from "phaser";
import type { GameState } from "../../core/index";
import { TEXT, textStyle } from "./presentation";
import { FONTS } from "./fonts";
import { HUD_LAYOUT } from "./layout";
import { addTooltip } from "./TooltipView";

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

const HUD_TOOLTIPS = {
  hp: {
    title: "Current HP",
    body: "Your current health. If this reaches 0 you lose the game.",
  },
  energy: {
    title: "Current Energy",
    body: "Your current energy used to play some cards. Gain 1 per turn or with some cards.",
  },
  act: {
    title: "Act Progression",
    body: "Each world has its own act progression. You start at Act 1 and progress by surviving hazards.",
  },
  light: {
    title: "Light Level",
    body: "The current level of light. Have a light level creater than the conceal of a card to reveal it.",
  },
  heat: {
    title: "Heat",
    body: "Spendable warmth for thawing frozen cards. Heat does not decay.",
  },
  brace: {
    title: "Available Brace",
    body: "You can brace your self for grasping attacks which can steal your cards.",
  },
  forceDestroy: {
    title: "Amount to be Grasped",
    body: "The number of player cards which will be destroyed at the start of your next turn.",
  },
};

interface PowerUpIndicator {
  container: Phaser.GameObjects.Container;
  countText: Phaser.GameObjects.Text;
  icon?: Phaser.GameObjects.Image;
}

export class HUDView extends Phaser.GameObjects.Container {
  private hpText: Phaser.GameObjects.Text;
  private actText: Phaser.GameObjects.Text;
  private energyText: Phaser.GameObjects.Text;
  private powerUps: Phaser.GameObjects.Container;
  private powerUpIndicators: PowerUpIndicator[] = [];
  private braceIndicator: PowerUpIndicator | undefined;
  private forceDestroyIndicator: PowerUpIndicator | undefined;
  private lightIndicator: PowerUpIndicator | undefined;
  private heatIndicator: PowerUpIndicator | undefined;
  private keywordIndicators: Record<string, PowerUpIndicator> = {};
  private guardIndicator: PowerUpIndicator | undefined;
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
    const style = textStyle({
      fontFamily: FONTS.monospace,
      fontSize: "16px",
      fontStyle: "bold",
      color: TEXT.textLight,
    });

    // Origin (0, 0.5): x is the panel-relative left edge of the label, y is the
    // panel's vertical center, so every label is vertically centered in the bar.
    this.hpText = scene.add.text(HUD_LAYOUT.labels.hpX, HUD_PANEL_H / 2, "HP: —", {
      ...style,
      color: TEXT.textHp,
    });
    addTooltip(this.scene, this.hpText, HUD_TOOLTIPS.hp);
    this.actText = scene.add.text(HUD_LAYOUT.labels.actX, HUD_PANEL_H / 2, "Act 1 / 3", style);
    addTooltip(this.scene, this.actText, HUD_TOOLTIPS.act);
    this.energyText = scene.add.text(HUD_LAYOUT.labels.energyX, HUD_PANEL_H / 2, "—", {
      ...style,
      color: TEXT.textEnergy,
    });
    this.powerUps = scene.add.container(HUD_LAYOUT.labels.powerUpX, HUD_PANEL_H / 2);
    const energyIcon = scene.add
      .image(
        this.energyText.x - HUD_LAYOUT.energyIconOffsetX,
        this.energyText.y,
        "effect-icon-energy",
      )
      .setDisplaySize(HUD_LAYOUT.energyIconSize, HUD_LAYOUT.energyIconSize);
    addTooltip(this.scene, energyIcon, HUD_TOOLTIPS.energy);

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
    if (state.light > 0) {
      if (this.lightIndicator === undefined) {
        this.lightIndicator = this.addPowerUp("effect-icon-light");
        if (this.lightIndicator.icon) {
          addTooltip(this.scene, this.lightIndicator.icon, HUD_TOOLTIPS.light);
        }
      }
      this.setPowerUpValue(this.lightIndicator, state.light);
    } else if (this.lightIndicator !== undefined) {
      this.lightIndicator.container.setVisible(false);
    }
    if (state.heat > 0) {
      if (this.heatIndicator === undefined) {
        this.heatIndicator = this.addPowerUp("effect-icon-heat");
        if (this.heatIndicator.icon) {
          addTooltip(this.scene, this.heatIndicator.icon, HUD_TOOLTIPS.heat);
        }
      }
      this.setPowerUpValue(this.heatIndicator, state.heat);
    } else if (this.heatIndicator !== undefined) {
      this.heatIndicator.container.setVisible(false);
    }
    if (state.braceCharges > 0) {
      if (this.braceIndicator === undefined) {
        this.braceIndicator = this.addPowerUp("effect-icon-brace");
        if (this.braceIndicator.icon) {
          addTooltip(this.scene, this.braceIndicator.icon, HUD_TOOLTIPS.brace);
        }
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
        if (this.forceDestroyIndicator.icon) {
          addTooltip(this.scene, this.forceDestroyIndicator.icon, HUD_TOOLTIPS.forceDestroy);
        }
      }
      this.setPowerUpValue(this.forceDestroyIndicator, state.pendingForceDestroy);
    } else {
      if (this.forceDestroyIndicator !== undefined) {
        this.forceDestroyIndicator.container.setVisible(false);
      }
    }
    Object.keys(this.keywordIndicators).forEach((key) => {
      this.keywordIndicators[key]?.container.setVisible(false);
    });
    if (state.pendingKeywordNextWorldCard.length > 0) {
      state.pendingKeywordNextWorldCard.forEach((kw) => {
        if ((kw.value ?? 0) > 0) {
          const indicator = this.keywordIndicators[kw.name] ?? this.addKeyword(kw.name);
          this.keywordIndicators[kw.name] = indicator;
          this.setPowerUpValue(indicator, kw.value ?? 0);
        }
      });
    }
    if (state.keywordGuard > 0) {
      if (this.guardIndicator === undefined) {
        this.guardIndicator = this.addKeyword("Guard", false);
      }
      this.setPowerUpValue(this.guardIndicator, state.keywordGuard);
    } else {
      if (this.guardIndicator !== undefined) {
        this.guardIndicator.container.setVisible(false);
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
    const style = textStyle({
      fontFamily: FONTS.monospace,
      fontSize: "16px",
      fontStyle: "bold",
      color: TEXT.textLight,
    });
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

    const indicator: PowerUpIndicator = { container, countText, icon };
    this.powerUpIndicators.push(indicator);
    return indicator;
  }

  private addKeyword(keyword: string, bPenalty: boolean = true): PowerUpIndicator {
    const kwStyle = textStyle({
      fontFamily: FONTS.monospace,
      fontSize: "16px",
      fontStyle: "bold",
      color: bPenalty ? TEXT.textPenalty : TEXT.textReward,
    });
    const style = textStyle({
      fontFamily: FONTS.monospace,
      fontSize: "16px",
      fontStyle: "bold",
      color: TEXT.textLight,
    });
    const container = this.scene.add.container(0, 0);
    const keytext = this.scene.add
      .text(0, 0, keyword, kwStyle)
      .setDisplaySize(HUD_POWER_UPS.iconSize, HUD_POWER_UPS.iconSize);
    const countText = this.scene.add.text(
      HUD_POWER_UPS.iconSize + HUD_POWER_UPS.countGap,
      0,
      "",
      style,
    );

    keytext.setOrigin(0, 0.5);
    countText.setOrigin(0, 0.5);
    container.add([keytext, countText]);
    this.powerUps.add(container);

    const indicator: PowerUpIndicator = { container, countText };
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
