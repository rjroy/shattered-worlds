import Phaser from "phaser";
import { startMainTheme, setMainThemeVolume } from "../audio/menuMusic";
import { loadAssets } from "../data/assetManifest";
import { isWorldUnlocked, UNLOCK_CATALOG } from "../../data/unlocks/catalog";
import { worldManifest } from "../../data/worldManifest";
import { worldDisplayManifest, type WorldDisplayData } from "../../data/worldDisplayManifest";
import type { RunStatsReader } from "../runtime/runStats";
import type { UnlocksStore } from "../runtime/unlocksProfile";
import { selectTheme } from "../view/themes/themeManifest";
import { textStyle, TEXT } from "../view/presentation";
import { FONTS } from "../view/fonts";
import { CANVAS_W, CANVAS_H, WORLD_SELECT_LAYOUT } from "../view/layout";
import { worldBadgeLabel, difficultyPips, cycleLabel } from "../view/worldBadge";
import { HelpOverlayView } from "../view/HelpOverlayView";
import { SettingsOverlayView } from "../view/SettingsOverlayView";
import { canPageLeft, canPageRight, pageLeft, pageRight } from "./worldSelectPaging";
import { UserSettingsStore } from "../runtime/userSettings";
import type { GriefSupportStore } from "../runtime/griefSupportProfile";
import {
  canAccessGriefSupport,
  GRIEF_SUPPORT_WORLD_IDS,
  shouldShowGriefSupport,
} from "./griefSupportGate";

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
  private readonly griefSupportStore: GriefSupportStore | undefined;
  private loadingLabel?: Phaser.GameObjects.Text;
  private progressTween: Phaser.Tweens.Tween | undefined = undefined;
  private bFirstLoad: boolean = true;

  constructor(
    runStats?: RunStatsReader,
    unlocksStore?: UnlocksStore,
    userSettings?: UserSettingsStore,
    griefSupportStore?: GriefSupportStore,
  ) {
    super({ key: "WorldSelect" });
    this.runStats = runStats;
    this.unlocksStore = unlocksStore;
    this.userSettings = userSettings;
    this.griefSupportStore = griefSupportStore;
  }

  preload(): void {
    loadAssets(this);
    this.loadingLabel = this.add
      .text(
        WORLD_SELECT_LAYOUT.center.x,
        WORLD_SELECT_LAYOUT.center.y,
        "Loading...",
        textStyle({
          fontFamily: FONTS.title,
          fontSize: "40px",
          fontStyle: "italic",
          color: TEXT.textWorldTitle,
        }),
      )
      .setOrigin(0.5, 0.5);
    this.progressTween = this.tweens.add({
      targets: this.loadingLabel,
      x: {
        start: this.loadingLabel.x,
        from: this.loadingLabel.x - 50,
        to: this.loadingLabel.x + 50,
      },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Cubic.easeInOut",
    });
  }

  create(): void {
    startMainTheme(this, this.userSettings);

    // title image fills canvas
    const bgImg = this.add
      .image(WORLD_SELECT_LAYOUT.center.x, WORLD_SELECT_LAYOUT.center.y, "world-select-bg")
      .setDisplaySize(CANVAS_W, CANVAS_H);

    const loadingTween = this.tweens.add({
      targets: this.loadingLabel,
      alpha: { from: 1, to: 0 },
      duration: 500,
      ease: "Cubic.easeIn",
    });
    loadingTween.on("complete", () => {
      this.tweens.remove(loadingTween);
      if (this.progressTween) {
        this.progressTween.stop();
        this.tweens.remove(this.progressTween);
        this.progressTween = undefined;
      }
    });
    const bgTween = this.tweens.add({
      targets: bgImg,
      alpha: { from: 0, to: 1 },
      duration: 300,
      ease: "Cubic.easeIn",
    });
    bgTween.on("complete", () => this.tweens.remove(bgTween));

    this.time.delayedCall(this.bFirstLoad ? WORLD_SELECT_LAYOUT.card.delay.first : 0, () => {
      const uiObjects = [];
      // subtitle only — logotype is in the image
      uiObjects.push(
        this.add
          .text(
            WORLD_SELECT_LAYOUT.selection.x,
            WORLD_SELECT_LAYOUT.selection.y,
            "Choose your shard ",
            textStyle({
              fontFamily: FONTS.title,
              fontSize: "20px",
              fontStyle: "italic",
              color: TEXT.textWorldTag,
            }),
          )
          .setOrigin(0.5, 0.5),
      );

      const INF_CYCLE = 100;
      this.worldIds = Object.keys(worldManifest);
      this.worldIds.sort((a, b) => {
        const cycleA = worldDisplayManifest[a]?.cycle ?? INF_CYCLE;
        const cycleB = worldDisplayManifest[b]?.cycle ?? INF_CYCLE;
        const cycleDelta = cycleA - cycleB;
        if (cycleDelta !== 0) return cycleDelta;

        const difficultyA = worldDisplayManifest[a]?.difficulty ?? INF_CYCLE;
        const difficultyB = worldDisplayManifest[b]?.difficulty ?? INF_CYCLE;
        const difficultyDelta = difficultyA - difficultyB;
        if (difficultyDelta !== 0) return difficultyDelta;

        const nameA = worldManifest[a]?.name ?? "";
        const nameB = worldManifest[b]?.name ?? "";
        return nameA.localeCompare(nameB);
      });
      this.visibleStartIndex = 0;
      uiObjects.push(this.createChronicleButton());
      uiObjects.push(this.createDestinyButton());
      if (this.canShowGriefSupportButton()) {
        uiObjects.push(this.createGriefSupportButton());
      }
      uiObjects.push(this.createHelpButton());
      uiObjects.push(this.createSettingsButton());
      const arrows = this.createArrows();

      arrows.forEach((arrow) => arrow.setAlpha(0));

      const firstLoadTween = this.tweens.add({
        targets: uiObjects,
        alpha: { from: 0, to: 1 },
        duration: this.bFirstLoad
          ? WORLD_SELECT_LAYOUT.card.delay.first
          : WORLD_SELECT_LAYOUT.card.delay.repeat,
        ease: "Cubic.easeIn",
      });
      firstLoadTween.on("complete", () => {
        this.tweens.remove(firstLoadTween);
        this.renderVisibleWorlds();
      });

      this.input.keyboard?.on("keydown-ESC", () => {
        if (this.helpOverlay?.visible) this.helpOverlay.setVisible(false);
      });

      this.bFirstLoad = true;
    });
  }

  private createChronicleButton(): Phaser.GameObjects.Container {
    const button = this.add.container(
      WORLD_SELECT_LAYOUT.buttons.chronicle.x,
      WORLD_SELECT_LAYOUT.buttons.chronicle.y,
    );
    const bg = this.add.rectangle(
      0,
      0,
      WORLD_SELECT_LAYOUT.buttons.chronicle.width,
      WORLD_SELECT_LAYOUT.buttons.chronicle.height,
      WORLD_SELECT_LAYOUT.buttons.bg.color,
      WORLD_SELECT_LAYOUT.buttons.bg.alpha,
    );
    bg.setStrokeStyle(
      WORLD_SELECT_LAYOUT.buttons.stroke.width,
      WORLD_SELECT_LAYOUT.buttons.stroke.color,
      WORLD_SELECT_LAYOUT.buttons.stroke.alpha,
    );

    bg.setRounded(WORLD_SELECT_LAYOUT.buttons.bg.rounded);
    bg.setInteractive({ useHandCursor: true });
    const label = this.add
      .text(
        0,
        0,
        "Chronicle",
        textStyle({
          fontFamily: FONTS.title,
          fontSize: WORLD_SELECT_LAYOUT.buttons.chronicle.fontSize,
          color: TEXT.textSelect,
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0.5);
    button.add([bg, label]);
    bg.on("pointerover", () => button.setScale(WORLD_SELECT_LAYOUT.buttons.hoverScale));
    bg.on("pointerout", () => button.setScale(1));
    bg.on("pointerdown", () => {
      if (this.scene.isActive()) this.scene.start("Chronicle");
    });
    return button;
  }

  private createDestinyButton(): Phaser.GameObjects.Container {
    const button = this.add.container(
      WORLD_SELECT_LAYOUT.buttons.destiny.x,
      WORLD_SELECT_LAYOUT.buttons.destiny.y,
    );
    const bg = this.add.rectangle(
      0,
      0,
      WORLD_SELECT_LAYOUT.buttons.destiny.width,
      WORLD_SELECT_LAYOUT.buttons.destiny.height,
      WORLD_SELECT_LAYOUT.buttons.bg.color,
      WORLD_SELECT_LAYOUT.buttons.bg.alpha,
    );
    bg.setStrokeStyle(
      WORLD_SELECT_LAYOUT.buttons.stroke.width,
      WORLD_SELECT_LAYOUT.buttons.stroke.color,
      WORLD_SELECT_LAYOUT.buttons.stroke.alpha,
    );
    bg.setRounded(WORLD_SELECT_LAYOUT.buttons.bg.rounded);
    bg.setInteractive({ useHandCursor: true });
    const label = this.add
      .text(
        0,
        0,
        "Destiny",
        textStyle({
          fontFamily: FONTS.title,
          fontSize: WORLD_SELECT_LAYOUT.buttons.destiny.fontSize,
          color: TEXT.textSelect,
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0.5);
    button.add([bg, label]);
    bg.on("pointerover", () => button.setScale(WORLD_SELECT_LAYOUT.buttons.hoverScale));
    bg.on("pointerout", () => button.setScale(1));
    bg.on("pointerdown", () => {
      if (this.scene.isActive()) this.scene.start("Destiny");
    });
    return button;
  }

  private createGriefSupportButton(): Phaser.GameObjects.Container {
    const button = this.add.container(
      WORLD_SELECT_LAYOUT.buttons.support.x,
      WORLD_SELECT_LAYOUT.buttons.support.y,
    );
    const bg = this.add.rectangle(
      0,
      0,
      WORLD_SELECT_LAYOUT.buttons.support.width,
      WORLD_SELECT_LAYOUT.buttons.support.height,
      WORLD_SELECT_LAYOUT.buttons.bg.color,
      WORLD_SELECT_LAYOUT.buttons.bg.alpha,
    );
    bg.setStrokeStyle(
      WORLD_SELECT_LAYOUT.buttons.stroke.width,
      WORLD_SELECT_LAYOUT.buttons.stroke.color,
      WORLD_SELECT_LAYOUT.buttons.stroke.alpha,
    );
    bg.setRounded(WORLD_SELECT_LAYOUT.buttons.bg.rounded);
    bg.setInteractive({ useHandCursor: true });
    const label = this.add
      .text(
        0,
        0,
        "Support",
        textStyle({
          fontFamily: FONTS.title,
          fontSize: WORLD_SELECT_LAYOUT.buttons.support.fontSize,
          color: TEXT.textSelect,
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0.5);
    button.add([bg, label]);
    bg.on("pointerover", () => button.setScale(WORLD_SELECT_LAYOUT.buttons.hoverScale));
    bg.on("pointerout", () => button.setScale(1));
    bg.on("pointerdown", () => {
      if (!this.scene.isActive()) return;
      this.scene.launch("GriefSupport", { worldId: undefined, mode: "standalone" });
      this.scene.pause();
    });
    return button;
  }

  private createHelpButton(): Phaser.GameObjects.Container {
    const button = this.add.container(
      WORLD_SELECT_LAYOUT.buttons.help.x,
      WORLD_SELECT_LAYOUT.buttons.help.y,
    );
    const bg = this.add.rectangle(
      0,
      0,
      WORLD_SELECT_LAYOUT.buttons.help.width,
      WORLD_SELECT_LAYOUT.buttons.help.height,
      WORLD_SELECT_LAYOUT.buttons.bg.color,
      WORLD_SELECT_LAYOUT.buttons.bg.alpha,
    );
    bg.setStrokeStyle(
      WORLD_SELECT_LAYOUT.buttons.stroke.width,
      WORLD_SELECT_LAYOUT.buttons.stroke.color,
      WORLD_SELECT_LAYOUT.buttons.stroke.alpha,
    );
    bg.setRounded(WORLD_SELECT_LAYOUT.buttons.bg.rounded);
    bg.setInteractive({ useHandCursor: true });
    const label = this.add
      .text(
        0,
        0,
        "?",
        textStyle({
          fontFamily: FONTS.monospace,
          fontSize: WORLD_SELECT_LAYOUT.buttons.help.fontSize,
          color: TEXT.textSelect,
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0.5);
    button.add([bg, label]);
    bg.on("pointerover", () => button.setScale(WORLD_SELECT_LAYOUT.buttons.hoverScale));
    bg.on("pointerout", () => button.setScale(1));
    bg.on("pointerdown", () => {
      if (this.scene.isActive()) this.showHelpOverlay();
    });
    return button;
  }

  private createSettingsButton(): Phaser.GameObjects.Container {
    const button = this.add.container(
      WORLD_SELECT_LAYOUT.buttons.setting.x,
      WORLD_SELECT_LAYOUT.buttons.setting.y,
    );
    const bg = this.add.rectangle(
      0,
      0,
      WORLD_SELECT_LAYOUT.buttons.setting.width,
      WORLD_SELECT_LAYOUT.buttons.setting.height,
      WORLD_SELECT_LAYOUT.buttons.bg.color,
      WORLD_SELECT_LAYOUT.buttons.bg.alpha,
    );
    bg.setStrokeStyle(
      WORLD_SELECT_LAYOUT.buttons.stroke.width,
      WORLD_SELECT_LAYOUT.buttons.stroke.color,
      WORLD_SELECT_LAYOUT.buttons.stroke.alpha,
    );
    bg.setRounded(WORLD_SELECT_LAYOUT.buttons.bg.rounded);
    bg.setInteractive({ useHandCursor: true });
    const label = this.add
      .text(
        0,
        0,
        "S",
        textStyle({
          fontFamily: FONTS.monospace,
          fontSize: WORLD_SELECT_LAYOUT.buttons.setting.fontSize,
          color: TEXT.textSelect,
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0.5);
    button.add([bg, label]);
    bg.on("pointerover", () => button.setScale(WORLD_SELECT_LAYOUT.buttons.hoverScale));
    bg.on("pointerout", () => button.setScale(1));
    bg.on("pointerdown", () => {
      if (this.scene.isActive()) this.showSettingsOverlay();
    });
    return button;
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
      this.settingsOverlay = new SettingsOverlayView(this, this.userSettings, () =>
        setMainThemeVolume(this, this.userSettings),
      );
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
      this.visibleStartIndex + WORLD_SELECT_LAYOUT.visibleWorldCount,
    );
    const totalW =
      visibleWorldIds.length * WORLD_SELECT_LAYOUT.card.width +
      (visibleWorldIds.length - 1) * WORLD_SELECT_LAYOUT.card.gap;
    const startX = (CANVAS_W - totalW) / 2 + WORLD_SELECT_LAYOUT.card.width / 2;

    visibleWorldIds.forEach((worldId, i) => {
      const display = worldDisplayManifest[worldId];
      if (display === undefined) {
        throw new Error(`WorldSelectScene: no display entry for worldId "${worldId}"`);
      }
      const accentColor = Phaser.Display.Color.HexStringToColor(
        selectTheme(worldId).intrusionHue,
      ).color;
      const cardX = startX + i * (WORLD_SELECT_LAYOUT.card.width + WORLD_SELECT_LAYOUT.card.gap);
      const newCard = this.createWorldCard(
        worldId,
        cardX,
        WORLD_SELECT_LAYOUT.card.y,
        display,
        accentColor,
      );
      this.cards.push(newCard);
      const appearTween = this.tweens.add({
        targets: newCard.container,
        alpha: { from: 0, to: 1 },
        scale: { from: this.bFirstLoad ? 0 : WORLD_SELECT_LAYOUT.card.repeatScale, to: 1 },
        duration: this.bFirstLoad
          ? WORLD_SELECT_LAYOUT.card.delay.first
          : WORLD_SELECT_LAYOUT.card.delay.repeat,
        ease: "Cubic.easeOut",
      });
      appearTween.on("complete", () => this.tweens.remove(appearTween));
    });

    this.updateArrowState();
  }

  private createArrows(): Phaser.GameObjects.Container[] {
    const visibleW =
      WORLD_SELECT_LAYOUT.visibleWorldCount * WORLD_SELECT_LAYOUT.card.width +
      (WORLD_SELECT_LAYOUT.visibleWorldCount - 1) * WORLD_SELECT_LAYOUT.card.gap;
    const rowLeft = (CANVAS_W - visibleW) / 2;
    const rowRight = rowLeft + visibleW;

    this.leftArrow = this.createArrow(
      rowLeft - WORLD_SELECT_LAYOUT.arrow.gap,
      WORLD_SELECT_LAYOUT.arrow.y,
      "<",
      () => {
        const next = pageLeft(this.visibleStartIndex, WORLD_SELECT_LAYOUT.visibleWorldCount);
        if (next === this.visibleStartIndex) return;
        this.visibleStartIndex = next;
        this.renderVisibleWorlds();
      },
    );
    this.rightArrow = this.createArrow(
      rowRight + WORLD_SELECT_LAYOUT.arrow.gap,
      WORLD_SELECT_LAYOUT.arrow.y,
      ">",
      () => {
        const next = pageRight(
          this.visibleStartIndex,
          this.worldIds.length,
          WORLD_SELECT_LAYOUT.visibleWorldCount,
        );
        if (next === this.visibleStartIndex) return;
        this.visibleStartIndex = next;
        this.renderVisibleWorlds();
      },
    );
    return [this.leftArrow.container, this.rightArrow.container];
  }

  private createArrow(x: number, y: number, label: string, onClick: () => void): WorldSelectArrow {
    const container = this.add.container(x, y);
    const hitArea = this.add.rectangle(
      0,
      0,
      WORLD_SELECT_LAYOUT.arrow.width,
      WORLD_SELECT_LAYOUT.arrow.height,
      WORLD_SELECT_LAYOUT.arrow.bg.color,
      WORLD_SELECT_LAYOUT.arrow.bg.alpha,
    );
    hitArea.setStrokeStyle(
      WORLD_SELECT_LAYOUT.arrow.stroke.width,
      WORLD_SELECT_LAYOUT.arrow.stroke.color,
      WORLD_SELECT_LAYOUT.arrow.stroke.alpha,
    );
    const text = this.add
      .text(
        0,
        0,
        label,
        textStyle({
          fontFamily: FONTS.monospace,
          fontSize: WORLD_SELECT_LAYOUT.arrow.fontSize,
          color: TEXT.textWorldTitle,
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0.5);

    container.add([hitArea, text]);
    container.setAlpha(0);
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
      canPageRight(
        this.visibleStartIndex,
        this.worldIds.length,
        WORLD_SELECT_LAYOUT.visibleWorldCount,
      ),
    );
  }

  private setArrowEnabled(arrow: WorldSelectArrow | undefined, enabled: boolean): void {
    if (arrow === undefined) return;
    const tween = this.tweens.add({
      targets: arrow.container,
      alpha: { from: arrow.container.alpha, to: enabled ? 1 : TEXT.dimAlpha },
      duration: WORLD_SELECT_LAYOUT.card.delay.repeat,
      ease: "Cubic.easeIn",
    });
    tween.on("complete", () => this.tweens.remove(tween));
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
        Phaser.Display.Color.ValueToColor(WORLD_SELECT_LAYOUT.card.blend.color),
        Phaser.Display.Color.HexStringToColor(selectTheme(worldId).intrusionHue),
        WORLD_SELECT_LAYOUT.card.blend.scale,
        WORLD_SELECT_LAYOUT.card.blend.weight,
      );
      img.setTint(tintColor.color);

      const scale = Math.max(
        WORLD_SELECT_LAYOUT.card.width / img.width,
        WORLD_SELECT_LAYOUT.card.height / img.height,
      );
      img.setScale(scale);

      const cropX = (img.width - WORLD_SELECT_LAYOUT.card.width / scale) / 2;
      const cropY = (img.height - WORLD_SELECT_LAYOUT.card.height / scale) / 2;
      const cropW = WORLD_SELECT_LAYOUT.card.width / scale;
      const cropH = WORLD_SELECT_LAYOUT.card.height / scale;
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
      const bg = this.add.rectangle(
        0,
        0,
        WORLD_SELECT_LAYOUT.card.width,
        WORLD_SELECT_LAYOUT.card.height,
        WORLD_SELECT_LAYOUT.card.blend.color,
      );
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
    const border = this.add.rectangle(
      0,
      0,
      WORLD_SELECT_LAYOUT.card.width,
      WORLD_SELECT_LAYOUT.card.height,
    );
    border.setStrokeStyle(WORLD_SELECT_LAYOUT.card.strokeWidth, accentColor);
    border.setFillStyle(); // transparent fill

    // content
    const nameText = this.add
      .text(
        0,
        WORLD_SELECT_LAYOUT.card.name.y,
        display.name,
        textStyle({
          fontFamily: FONTS.ui,
          fontSize: WORLD_SELECT_LAYOUT.card.name.fontSize,
          color: TEXT.textWorldTitle,
          fontStyle: "bold",
          align: "center",
          wordWrap: { width: WORLD_SELECT_LAYOUT.card.wordWrap },
        }),
      )
      .setOrigin(0.5, 0);

    const nameBg = this.add
      .rectangle(
        nameText.x,
        nameText.y - 2,
        nameText.width + 4,
        nameText.height + 4,
        WORLD_SELECT_LAYOUT.card.text.bg.color,
        WORLD_SELECT_LAYOUT.card.text.bg.alpha,
      )
      .setOrigin(0.5, 0)
      .setRounded(WORLD_SELECT_LAYOUT.card.text.bg.rounded);

    const tagLineY = Math.max(
      WORLD_SELECT_LAYOUT.card.tag.y,
      nameText.y + nameText.height + WORLD_SELECT_LAYOUT.card.text.gap,
    );
    const tagText = this.add
      .text(
        0,
        tagLineY,
        display.tagline,
        textStyle({
          fontFamily: FONTS.ui,
          fontSize: WORLD_SELECT_LAYOUT.card.tag.fontSize,
          color: TEXT.textWorldTag,
          fontStyle: "italic",
          align: "center",
          wordWrap: { width: WORLD_SELECT_LAYOUT.card.wordWrap },
        }),
      )
      .setOrigin(0.5, 0);

    const tagBg = this.add
      .rectangle(
        tagText.x,
        tagText.y - 2,
        tagText.width + 4,
        tagText.height + 4,
        WORLD_SELECT_LAYOUT.card.text.bg.color,
        WORLD_SELECT_LAYOUT.card.text.bg.alpha,
      )
      .setOrigin(0.5, 0)
      .setRounded(WORLD_SELECT_LAYOUT.card.text.bg.rounded);

    const storyLineY = Math.max(
      WORLD_SELECT_LAYOUT.card.story.y,
      tagText.y + tagText.height + WORLD_SELECT_LAYOUT.card.text.gap,
    );
    const storyText = this.add
      .text(
        0,
        storyLineY,
        display.story,
        textStyle({
          fontFamily: FONTS.ui,
          fontSize: WORLD_SELECT_LAYOUT.card.story.fontSize,
          color: TEXT.textWorldStory,
          align: "center",
          wordWrap: { width: WORLD_SELECT_LAYOUT.card.wordWrap },
        }),
      )
      .setOrigin(0.5, 0);
    const storyBg = this.add
      .rectangle(
        storyText.x,
        storyText.y - 2,
        storyText.width + 4,
        storyText.height + 4,
        WORLD_SELECT_LAYOUT.card.text.bg.color,
        WORLD_SELECT_LAYOUT.card.text.bg.alpha,
      )
      .setOrigin(0.5, 0)
      .setRounded(WORLD_SELECT_LAYOUT.card.text.bg.rounded);

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
      const badgeText = this.add
        .text(
          WORLD_SELECT_LAYOUT.card.badge.x,
          WORLD_SELECT_LAYOUT.card.badge.y,
          badge,
          textStyle({
            fontFamily: FONTS.monospace,
            fontSize: WORLD_SELECT_LAYOUT.card.badge.fontSize,
            color: TEXT.textLight,
            fontStyle: "bold",
          }),
        )
        .setOrigin(0.5, 0.5);
      const badgeTitle = this.add
        .text(
          badgeText.x,
          badgeText.y - badgeText.height - 6,
          "win rate",
          textStyle({
            fontFamily: FONTS.body,
            fontSize: WORLD_SELECT_LAYOUT.card.badge.fontSize,
            color: TEXT.textLight,
          }),
        )
        .setOrigin(0.5, 0.5);
      const badgeBg = this.add.rectangle(
        WORLD_SELECT_LAYOUT.card.badge.x,
        WORLD_SELECT_LAYOUT.card.badge.y,
        badgeText.width + 14,
        badgeText.height + 6,
        WORLD_SELECT_LAYOUT.card.text.bg.color,
        WORLD_SELECT_LAYOUT.card.text.bg.alpha,
      );
      badgeBg.setStrokeStyle(1, accentColor, WORLD_SELECT_LAYOUT.card.text.bg.alpha);
      badgeBg.setRounded(WORLD_SELECT_LAYOUT.card.badge.rounded);
      contents.push(badgeBg, badgeTitle, badgeText);
    }

    const cycleText = this.add
      .text(
        WORLD_SELECT_LAYOUT.card.cycle.x,
        WORLD_SELECT_LAYOUT.card.cycle.y,
        cycleLabel(display.cycle),
        textStyle({
          fontFamily: FONTS.monospace,
          fontSize: WORLD_SELECT_LAYOUT.card.cycle.fontSize,
          color: TEXT.textLight,
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0.5);
    const cycleTitle = this.add
      .text(
        cycleText.x,
        cycleText.y - cycleText.height - 6,
        "cycle",
        textStyle({
          fontFamily: FONTS.body,
          fontSize: WORLD_SELECT_LAYOUT.card.cycle.fontSize,
          color: TEXT.textLight,
        }),
      )
      .setOrigin(0.5, 0.5);
    const cycleBg = this.add.rectangle(
      WORLD_SELECT_LAYOUT.card.cycle.x,
      WORLD_SELECT_LAYOUT.card.cycle.y,
      cycleText.width + 14,
      cycleText.height + 6,
      WORLD_SELECT_LAYOUT.card.text.bg.color,
      WORLD_SELECT_LAYOUT.card.text.bg.alpha,
    );
    cycleBg.setStrokeStyle(1, accentColor, WORLD_SELECT_LAYOUT.card.text.bg.alpha);
    cycleBg.setRounded(WORLD_SELECT_LAYOUT.card.cycle.rounded);
    contents.push(cycleBg, cycleTitle, cycleText);

    if (locked) {
      const overlay = this.add.rectangle(
        0,
        0,
        WORLD_SELECT_LAYOUT.card.width,
        WORLD_SELECT_LAYOUT.card.height,
        WORLD_SELECT_LAYOUT.card.locked.overlay.color,
        WORLD_SELECT_LAYOUT.card.locked.overlay.alpha,
      );
      const lockLabel = this.add
        .text(
          0,
          WORLD_SELECT_LAYOUT.card.locked.y,
          `Locked - Destiny${lockState.cost === null ? "" : ` ${lockState.cost} Fragments`}`,
          textStyle({
            fontFamily: FONTS.ui,
            fontSize: WORLD_SELECT_LAYOUT.card.locked.fontSize,
            color: WORLD_SELECT_LAYOUT.card.locked.textColor,
            fontStyle: "bold",
            align: "center",
            wordWrap: { width: WORLD_SELECT_LAYOUT.card.wordWrap },
          }),
        )
        .setOrigin(0.5, 0.5);
      const lockBg = this.add
        .rectangle(
          0,
          lockLabel.y,
          lockLabel.width + 14,
          lockLabel.height + 6,
          WORLD_SELECT_LAYOUT.card.text.bg.color,
          WORLD_SELECT_LAYOUT.card.locked.alpha,
        )
        .setOrigin(0.5, 0.5)
        .setRounded(WORLD_SELECT_LAYOUT.card.locked.rounded);
      lockBg.setStrokeStyle(
        1,
        WORLD_SELECT_LAYOUT.card.locked.stroke.color,
        WORLD_SELECT_LAYOUT.card.locked.stroke.alpha,
      );
      contents.push(overlay, lockBg, lockLabel);
    }

    // Difficulty pips — bottom-left footer, mirroring the wins/runs badge on the
    // right. Pushed after the lock block so they stay readable on locked cards.
    const pipX = WORLD_SELECT_LAYOUT.card.pip.x;
    const pipY = WORLD_SELECT_LAYOUT.card.pip.y;
    const pipText = this.add
      .text(
        pipX,
        pipY,
        difficultyPips(display.difficulty),
        textStyle({
          fontFamily: FONTS.monospace,
          fontSize: WORLD_SELECT_LAYOUT.card.pip.fontSize,
          color: TEXT.textLight,
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0.5);
    const pipTitle = this.add
      .text(
        pipText.x,
        pipText.y - pipText.height - 6,
        "difficulty",
        textStyle({
          fontFamily: FONTS.body,
          fontSize: WORLD_SELECT_LAYOUT.card.pip.fontSize,
          color: TEXT.textLight,
        }),
      )
      .setOrigin(0.5, 0.5);
    const pipBg = this.add
      .rectangle(
        pipText.x,
        pipText.y,
        pipText.width + 12,
        pipText.height + 6,
        WORLD_SELECT_LAYOUT.card.text.bg.color,
        WORLD_SELECT_LAYOUT.card.text.bg.alpha,
      )
      .setOrigin(0.5, 0.5)
      .setRounded(WORLD_SELECT_LAYOUT.card.pip.rounded);
    pipBg.setStrokeStyle(1, accentColor, 0.8);
    contents.push(pipBg, pipText, pipTitle);

    container.add(contents);

    bg.on("pointerover", () =>
      container.setScale(
        locked ? WORLD_SELECT_LAYOUT.card.locked.scale : WORLD_SELECT_LAYOUT.hoverScale,
      ),
    );
    bg.on("pointerout", () => container.setScale(1.0));
    bg.on("pointerdown", () => {
      if (locked) {
        this.scene.start("Destiny");
        return;
      }

      bg.disableInteractive();
      this.disableCarouselInteractions();
      const seed = Math.floor(Math.random() * 2 ** 32);
      // The grief-support notice is a one-time, trilogy-level acknowledgment
      // (REQ-W13-30..33), not a per-world gate: once seen for any of the
      // three, every one of them skips straight to Table.
      const hasSeenGriefSupportNotice =
        this.griefSupportStore?.get().hasSeenGriefSupportNotice ?? true;
      if (shouldShowGriefSupport(worldId, hasSeenGriefSupportNotice)) {
        this.scene.launch("GriefSupport", { worldId, seed });
      } else {
        this.scene.launch("Table", { worldId, seed });
      }
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

  private canShowGriefSupportButton(): boolean {
    return canAccessGriefSupport(this.unlockedGriefSupportWorldIds());
  }

  private firstUnlockedGriefSupportWorldId(): string | undefined {
    return this.unlockedGriefSupportWorldIds()[0];
  }

  private unlockedGriefSupportWorldIds(): string[] {
    return GRIEF_SUPPORT_WORLD_IDS.filter((worldId) => !this.getWorldLockState(worldId).locked);
  }

  private disableCarouselInteractions(): void {
    this.cards.forEach((card) => card.background.disableInteractive());
    this.leftArrow?.hitArea.disableInteractive();
    this.rightArrow?.hitArea.disableInteractive();
  }
}
