import Phaser from "phaser";
import { startMainTheme } from "../audio/menuMusic";
import { loadAssets } from "../data/assetManifest";
import { isWorldUnlocked, UNLOCK_CATALOG } from "../../data/unlocks/catalog";
import { worldManifest } from "../../data/worldManifest";
import { worldDisplayManifest, type WorldDisplayData } from "../../data/worldDisplayManifest";
import type { RunStatsReader } from "../runtime/runStats";
import type { UnlocksStore } from "../runtime/unlocksProfile";
import { selectTheme } from "../view/themes/themeManifest";
import { textStyle, TEXT } from "../view/presentation";
import { CANVAS_W, CANVAS_H, WORLD_SELECT_LAYOUT } from "../view/layout";
import { worldBadgeLabel } from "../view/worldBadge";
import { HelpOverlayView } from "../view/HelpOverlayView";
import { SettingsOverlayView } from "../view/SettingsOverlayView";
import { canPageLeft, canPageRight, pageLeft, pageRight } from "./worldSelectPaging";
import { UserSettingsStore } from "../runtime/userSettings";

const CARD_W = WORLD_SELECT_LAYOUT.cardWidth;
const CARD_H = WORLD_SELECT_LAYOUT.cardHeight;
const CARD_GAP = WORLD_SELECT_LAYOUT.cardGap;
const CARD_Y = WORLD_SELECT_LAYOUT.cardY; // card center y — over the stone-path area of the title image
const SUBTITLE_Y = WORLD_SELECT_LAYOUT.subtitleY;
const VISIBLE_WORLD_COUNT = WORLD_SELECT_LAYOUT.visibleWorldCount;
const ARROW_Y = CARD_Y;
const ARROW_W = WORLD_SELECT_LAYOUT.arrowWidth;
const ARROW_H = WORLD_SELECT_LAYOUT.arrowHeight;
const ARROW_GAP = WORLD_SELECT_LAYOUT.arrowGap;

// Common return type for the world card background, which may be either an image or a simple colored rectangle
type WorldCardBackground = Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
type WorldCardView = {
  container: Phaser.GameObjects.Container;
  background: WorldCardBackground;
};
type WorldSelectArrow = {
  container: Phaser.GameObjects.Container;
  hitArea: Phaser.GameObjects.Rectangle;
};
type WorldLockState = {
  locked: boolean;
  cost: number | null;
};

export class WorldSelectScene extends Phaser.Scene {
  cards: WorldCardView[] = [];
  private worldIds: string[] = [];
  private visibleStartIndex = 0;
  private leftArrow?: WorldSelectArrow;
  private rightArrow?: WorldSelectArrow;
  private helpOverlay?: HelpOverlayView;
  private settingsOverlay?: SettingsOverlayView;
  private readonly runStats: RunStatsReader | undefined;
  private readonly unlocksStore: UnlocksStore | undefined;
  private readonly userSettings: UserSettingsStore | undefined;

  constructor(
    runStats?: RunStatsReader,
    unlocksStore?: UnlocksStore,
    userSettings?: UserSettingsStore,
  ) {
    super({ key: "WorldSelect" });
    this.runStats = runStats;
    this.unlocksStore = unlocksStore;
    this.userSettings = userSettings;
  }

  preload(): void {
    loadAssets(this);
  }

  create(): void {
    void startMainTheme(this);

    // title image fills canvas
    this.add
      .image(CANVAS_W / 2, CANVAS_H / 2, "world-select-bg")
      .setDisplaySize(CANVAS_W, CANVAS_H);

    // subtitle only — logotype is in the image
    this.add
      .text(
        CANVAS_W / 2,
        SUBTITLE_Y,
        "Choose your shard",
        textStyle({
          fontSize: "20px",
          fontStyle: "italic",
          color: TEXT.textWorldTag,
        }),
      )
      .setOrigin(0.5, 0.5);

    this.worldIds = Object.keys(worldManifest);
    this.worldIds.sort((a, b) => {
      const lockA = this.getWorldLockState(a);
      const lockB = this.getWorldLockState(b);
      if (lockB.locked && !lockA.locked) return -1;
      if (lockA.locked && !lockB.locked) return 1;

      if (lockA.locked && lockB.locked) {
        const costDelta = (lockA.cost ?? 0) - (lockB.cost ?? 0);
        if (costDelta !== 0) return costDelta;
      }

      const nameA = worldManifest[a]?.name ?? "";
      const nameB = worldManifest[b]?.name ?? "";
      return nameA.localeCompare(nameB);
    });
    this.visibleStartIndex = 0;
    this.createChronicleButton();
    this.createDestinyButton();
    this.createHelpButton();
    this.createSettingsButton();
    this.createArrows();
    this.renderVisibleWorlds();

    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.helpOverlay?.visible) this.helpOverlay.setVisible(false);
    });
  }

  private createChronicleButton(): void {
    const button = this.add.container(CANVAS_W - 88, 34);
    const bg = this.add.rectangle(0, 0, 132, 34, 0x0f0b15, 0.82);
    bg.setStrokeStyle(1, 0xd6b15c, 0.9);
    bg.setRounded(6);
    bg.setInteractive({ useHandCursor: true });
    const label = this.add
      .text(
        0,
        -8,
        "Chronicle",
        textStyle({
          fontSize: "15px",
          color: "#d6b15c",
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0);
    button.add([bg, label]);
    bg.on("pointerover", () => button.setScale(1.08));
    bg.on("pointerout", () => button.setScale(1));
    bg.on("pointerdown", () => this.scene.start("Chronicle"));
  }

  private createDestinyButton(): void {
    const button = this.add.container(CANVAS_W - 256, 34);
    const bg = this.add.rectangle(0, 0, 108, 34, 0x0f0b15, 0.82);
    bg.setStrokeStyle(1, 0xd6b15c, 0.9);
    bg.setRounded(6);
    bg.setInteractive({ useHandCursor: true });
    const label = this.add
      .text(
        0,
        -8,
        "Destiny",
        textStyle({
          fontSize: "15px",
          color: "#d6b15c",
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0);
    button.add([bg, label]);
    bg.on("pointerover", () => button.setScale(1.08));
    bg.on("pointerout", () => button.setScale(1));
    bg.on("pointerdown", () => this.scene.start("Destiny"));
  }

  private createHelpButton(): void {
    const button = this.add.container(CANVAS_W - 178, 34);
    const bg = this.add.rectangle(0, 0, 34, 34, 0x0f0b15, 0.82);
    bg.setStrokeStyle(1, 0xd6b15c, 0.9);
    bg.setRounded(6);
    bg.setInteractive({ useHandCursor: true });
    const label = this.add
      .text(
        0,
        -9,
        "?",
        textStyle({
          fontSize: "20px",
          color: "#d6b15c",
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0);
    button.add([bg, label]);
    bg.on("pointerover", () => button.setScale(1.08));
    bg.on("pointerout", () => button.setScale(1));
    bg.on("pointerdown", () => this.showHelpOverlay());
  }

  private createSettingsButton(): void {
    const button = this.add.container(CANVAS_W - 335, 34);
    const bg = this.add.rectangle(0, 0, 34, 34, 0x0f0b15, 0.82);
    bg.setStrokeStyle(1, 0xd6b15c, 0.9);
    bg.setRounded(6);
    bg.setInteractive({ useHandCursor: true });
    const label = this.add
      .text(
        0,
        -9,
        "S",
        textStyle({
          fontSize: "20px",
          color: "#d6b15c",
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0);
    button.add([bg, label]);
    bg.on("pointerover", () => button.setScale(1.08));
    bg.on("pointerout", () => button.setScale(1));
    bg.on("pointerdown", () => this.showSettingsOverlay());
  }

  private showHelpOverlay(): void {
    const worldId = this.worldIds[this.visibleStartIndex];
    if (worldId === undefined) return;

    if (this.getWorldLockState(worldId).locked) {
      this.scene.start("Destiny");
      return;
    }

    this.helpOverlay?.destroy(true);
    const buildWorld = worldManifest[worldId];
    if (buildWorld === undefined) {
      throw new Error(`WorldSelectScene: no world builder found for worldId "${worldId}"`);
    }
    const totalActs = buildWorld("starter").worldData.deckComposition.acts.length;
    this.helpOverlay = new HelpOverlayView(this, worldId, totalActs);
    this.helpOverlay.setVisible(true);
  }

  private showSettingsOverlay(): void {
    if (this.userSettings) {
      this.settingsOverlay?.destroy(true);
      this.settingsOverlay = new SettingsOverlayView(this, this.userSettings);
      this.settingsOverlay.setVisible(true);
    }
  }

  private renderVisibleWorlds(): void {
    this.cards.forEach((card) => {
      const disappearTween = this.tweens.add({
        targets: card.container,
        alpha: { from: 1, to: 0 },
        scale: { from: 1, to: 0 },
        duration: 300,
        ease: "Cubic.easeIn",
      });
      disappearTween.on("complete", () => {
        card.container.destroy(true);
        this.tweens.remove(disappearTween);
      });
    });
    this.cards = [];

    const visibleWorldIds = this.worldIds.slice(
      this.visibleStartIndex,
      this.visibleStartIndex + VISIBLE_WORLD_COUNT,
    );
    const totalW = visibleWorldIds.length * CARD_W + (visibleWorldIds.length - 1) * CARD_GAP;
    const startX = (CANVAS_W - totalW) / 2 + CARD_W / 2;

    visibleWorldIds.forEach((worldId, i) => {
      const display = worldDisplayManifest[worldId];
      if (display === undefined) {
        throw new Error(`WorldSelectScene: no display entry for worldId "${worldId}"`);
      }
      const accentColor = Phaser.Display.Color.HexStringToColor(
        selectTheme(worldId).intrusionHue,
      ).color;
      const cardX = startX + i * (CARD_W + CARD_GAP);
      const newCard = this.createWorldCard(worldId, cardX, CARD_Y, display, accentColor);
      this.cards.push(newCard);
      const appearTween = this.tweens.add({
        targets: newCard.container,
        alpha: { from: 0, to: 1 },
        scale: { from: 0.8, to: 1 },
        duration: 300,
        ease: "Cubic.easeOut",
      });
      appearTween.on("complete", () => this.tweens.remove(appearTween));
    });

    this.updateArrowState();
  }

  private createArrows(): void {
    const visibleW = VISIBLE_WORLD_COUNT * CARD_W + (VISIBLE_WORLD_COUNT - 1) * CARD_GAP;
    const rowLeft = (CANVAS_W - visibleW) / 2;
    const rowRight = rowLeft + visibleW;

    this.leftArrow = this.createArrow(rowLeft - ARROW_GAP, ARROW_Y, "<", () => {
      const next = pageLeft(this.visibleStartIndex);
      if (next === this.visibleStartIndex) return;
      this.visibleStartIndex = next;
      this.renderVisibleWorlds();
    });
    this.rightArrow = this.createArrow(rowRight + ARROW_GAP, ARROW_Y, ">", () => {
      const next = pageRight(this.visibleStartIndex, this.worldIds.length, VISIBLE_WORLD_COUNT);
      if (next === this.visibleStartIndex) return;
      this.visibleStartIndex = next;
      this.renderVisibleWorlds();
    });
  }

  private createArrow(x: number, y: number, label: string, onClick: () => void): WorldSelectArrow {
    const container = this.add.container(x, y);
    const hitArea = this.add.rectangle(0, 0, ARROW_W, ARROW_H, 0x160f1f, 0.66);
    hitArea.setStrokeStyle(2, 0xc178bc, 0.9);
    const text = this.add
      .text(
        0,
        -3,
        label,
        textStyle({
          fontSize: "46px",
          color: TEXT.textWorldTitle,
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0.5);

    container.add([hitArea, text]);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on("pointerover", () => container.setScale(1.08));
    hitArea.on("pointerout", () => container.setScale(1.0));
    hitArea.on("pointerdown", onClick);

    return { container, hitArea };
  }

  private updateArrowState(): void {
    this.setArrowEnabled(this.leftArrow, canPageLeft(this.visibleStartIndex));
    this.setArrowEnabled(
      this.rightArrow,
      canPageRight(this.visibleStartIndex, this.worldIds.length, VISIBLE_WORLD_COUNT),
    );
  }

  private setArrowEnabled(arrow: WorldSelectArrow | undefined, enabled: boolean): void {
    if (arrow === undefined) return;
    arrow.container.setAlpha(enabled ? 1 : TEXT.dimAlpha);
    arrow.hitArea.setInteractive({ useHandCursor: enabled });
    if (!enabled) {
      arrow.hitArea.disableInteractive();
      arrow.container.setScale(1.0);
    }
  }

  private createWorldCardBackground(
    worldId: string,
    display: WorldDisplayData,
  ): WorldCardBackground {
    if (display.backgroundKey) {
      const img = this.add.image(0, 0, display.backgroundKey);

      const tintColor = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x5f4580),
        Phaser.Display.Color.HexStringToColor(selectTheme(worldId).intrusionHue),
        100,
        20,
      );
      img.setTint(tintColor.color);

      const scale = Math.max(CARD_W / img.width, CARD_H / img.height);
      img.setScale(scale);

      const cropX = (img.width - CARD_W / scale) / 2;
      const cropY = (img.height - CARD_H / scale) / 2;
      const cropW = CARD_W / scale;
      const cropH = CARD_H / scale;
      img.setCrop(cropX, cropY, cropW, cropH);

      // interactivity on background rect
      img.setInteractive({
        useHandCursor: true,
        hitArea: new Phaser.Geom.Rectangle(cropX, cropY, cropW, cropH),
        hitAreaCallback: (
          hitArea: Phaser.Geom.Rectangle,
          x: number,
          y: number,
          _gameObject: Phaser.GameObjects.GameObject,
        ) => {
          return hitArea.contains(x, y);
        },
      });
      return img;
    } else {
      const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x181c28);
      bg.setInteractive({ useHandCursor: true });
      return bg;
    }
  }

  private createWorldCard(
    worldId: string,
    cx: number,
    cy: number,
    display: WorldDisplayData,
    accentColor: number,
  ): WorldCardView {
    const container = this.add.container(cx, cy);
    const lockState = this.getWorldLockState(worldId);
    const locked = lockState.locked;

    // background + accent border
    const bg = this.createWorldCardBackground(worldId, display);
    const border = this.add.rectangle(0, 0, CARD_W, CARD_H);
    border.setStrokeStyle(2, accentColor);
    border.setFillStyle(); // transparent fill

    // content
    const nameText = this.add
      .text(
        0,
        -CARD_H / 2 + WORLD_SELECT_LAYOUT.nameY,
        display.name,
        textStyle({
          fontSize: "17px",
          color: TEXT.textWorldTitle,
          fontStyle: "bold",
          align: "center",
          wordWrap: { width: CARD_W - WORLD_SELECT_LAYOUT.textPadding },
        }),
      )
      .setOrigin(0.5, 0);

    const nameBg = this.add
      .rectangle(nameText.x, nameText.y - 2, nameText.width + 4, nameText.height + 4, 0x0b0710, 0.6)
      .setOrigin(0.5, 0)
      .setRounded(4);

    const tagLineY = Math.max(
      -CARD_H / 2 + WORLD_SELECT_LAYOUT.tagMinY,
      nameText.y + nameText.height + WORLD_SELECT_LAYOUT.textGap,
    );
    const tagText = this.add
      .text(
        0,
        tagLineY,
        display.tagline,
        textStyle({
          fontSize: "12px",
          color: TEXT.textWorldTag,
          fontStyle: "italic",
          align: "center",
          wordWrap: { width: CARD_W - WORLD_SELECT_LAYOUT.textPadding },
        }),
      )
      .setOrigin(0.5, 0);

    const tagBg = this.add
      .rectangle(tagText.x, tagText.y - 2, tagText.width + 4, tagText.height + 4, 0x0b0710, 0.6)
      .setOrigin(0.5, 0)
      .setRounded(4);

    const storyLineY = Math.max(
      -CARD_H / 2 + WORLD_SELECT_LAYOUT.storyMinY,
      tagText.y + tagText.height + WORLD_SELECT_LAYOUT.textGap,
    );
    const storyText = this.add
      .text(
        0,
        storyLineY,
        display.story,
        textStyle({
          fontSize: "12px",
          color: TEXT.textWorldStory,
          align: "center",
          wordWrap: { width: CARD_W - WORLD_SELECT_LAYOUT.textPadding },
        }),
      )
      .setOrigin(0.5, 0);
    const storyBg = this.add
      .rectangle(
        storyText.x,
        storyText.y - 2,
        storyText.width + 4,
        storyText.height + 4,
        0x0b0710,
        0.6,
      )
      .setOrigin(0.5, 0)
      .setRounded(4);

    const contents: Phaser.GameObjects.GameObject[] = [
      bg,
      border,
      nameBg,
      nameText,
      tagBg,
      tagText,
      storyBg,
      storyText,
    ];
    const badge = worldBadgeLabel(this.runStats?.lifetime().byWorld[worldId]);
    if (badge !== null) {
      const badgeBg = this.add.rectangle(CARD_W / 2 - 48, CARD_H / 2 - 28, 70, 26, 0x0b0710, 0.88);
      badgeBg.setStrokeStyle(1, accentColor, 0.8);
      badgeBg.setRounded(8);
      const badgeText = this.add
        .text(
          CARD_W / 2 - 48,
          CARD_H / 2 - 36,
          badge,
          textStyle({
            fontSize: "13px",
            color: TEXT.textLight,
            fontStyle: "bold",
          }),
        )
        .setOrigin(0.5, 0);
      contents.push(badgeBg, badgeText);
    }

    if (locked) {
      const overlay = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x050409, 0.52);
      const lockLabel = this.add
        .text(
          0,
          CARD_H / 2 - 38,
          `Locked - Destiny${lockState.cost === null ? "" : ` ${lockState.cost} Fragments`}`,
          textStyle({
            fontSize: "13px",
            color: "#f2d68a",
            fontStyle: "bold",
            align: "center",
            wordWrap: { width: CARD_W - 20 },
          }),
        )
        .setOrigin(0.5, 0);
      const lockBg = this.add
        .rectangle(0, lockLabel.y - 3, lockLabel.width + 14, lockLabel.height + 6, 0x0b0710, 0.9)
        .setOrigin(0.5, 0)
        .setRounded(5);
      lockBg.setStrokeStyle(1, 0xf2d68a, 0.72);
      contents.push(overlay, lockBg, lockLabel);
    }

    container.add(contents);

    bg.on("pointerover", () => container.setScale(locked ? 1.015 : WORLD_SELECT_LAYOUT.hoverScale));
    bg.on("pointerout", () => container.setScale(1.0));
    bg.on("pointerdown", () => {
      if (locked) {
        this.scene.start("Destiny");
        return;
      }

      bg.disableInteractive();
      this.disableCarouselInteractions();
      const seed = Math.floor(Math.random() * 2 ** 32);
      this.scene.launch("Table", { worldId, seed });
    });
    return { container, background: bg };
  }

  private getWorldLockState(worldId: string): WorldLockState {
    const gate = UNLOCK_CATALOG.find(
      (candidate) =>
        candidate.effect.type === "worldUnlock" && candidate.effect.worldId === worldId,
    );
    const profile = this.unlocksStore?.getProfile();
    const locked =
      profile === undefined ? false : !isWorldUnlocked(worldId, profile, UNLOCK_CATALOG);

    return {
      locked,
      cost: gate?.cost ?? null,
    };
  }

  private disableCarouselInteractions(): void {
    this.cards.forEach((card) => card.background.disableInteractive());
    this.leftArrow?.hitArea.disableInteractive();
    this.rightArrow?.hitArea.disableInteractive();
  }
}
