import Phaser from "phaser";

import {
  activeWeight,
  canActivate,
  computeSpendableBalance,
  DESTINY_BUDGET,
  UNLOCK_CATALOG,
} from "../../data/unlocks/catalog";
import type { UnlockDefinition } from "../../data/unlocks/types";
import type { FeatsStore } from "../runtime/featsProfile";
import type { UnlocksStore } from "../runtime/unlocksProfile";
import { unlockCardState } from "../view/unlockShop";
import { CANVAS_W, CANVAS_H } from "../view/layout";
import { TEXT, textStyle } from "../view/presentation";
import { addScreenBackdrop } from "../view/screenBackdrop";

const CARD_W = 382;
const CARD_H = 132;
const GRID_LEFT = 46;
const GRID_TOP = 112;
const GRID_GAP_X = 28;
const GRID_GAP_Y = 14;
const VISIBLE_ROWS = 3;
const TOUCH_SCROLL_THRESHOLD = 42;

type Button = {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
};

export class DestinyScene extends Phaser.Scene {
  private readonly featsStore: FeatsStore | undefined;
  private readonly unlocksStore: UnlocksStore | undefined;
  private content?: Phaser.GameObjects.Container;
  private messageText?: Phaser.GameObjects.Text;
  private confirmOverlay?: Phaser.GameObjects.Container;
  private scrollOffset = 0;
  private touchScrollLastY: number | undefined;
  private touchScrollRemainder = 0;

  constructor(featsStore?: FeatsStore, unlocksStore?: UnlocksStore) {
    super({ key: "Destiny" });
    this.featsStore = featsStore;
    this.unlocksStore = unlocksStore;
  }

  create(): void {
    this.scrollOffset = 0;
    addScreenBackdrop(this, {
      key: "screen-destiny",
      veilAlpha: 0.7,
      tint: 0xcbb8ff,
    });
    this.add.text(
      42,
      24,
      "Destiny",
      textStyle({
        fontSize: "32px",
        color: "#d6b15c",
        fontStyle: "bold",
      }),
    );

    this.createButton(74, 560, "Back", () => this.scene.start("WorldSelect"));
    this.messageText = this.add
      .text(
        CANVAS_W / 2,
        560,
        "",
        textStyle({
          fontSize: "13px",
          color: TEXT.textPenalty,
          align: "center",
          wordWrap: { width: 600 },
        }),
      )
      .setOrigin(0.5, 0.5);

    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("WorldSelect"));
    this.input.keyboard?.on("keydown-UP", () => this.scrollBy(-1));
    this.input.keyboard?.on("keydown-DOWN", () => this.scrollBy(1));
    this.input.on(
      "wheel",
      (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, deltaY: number) => {
        if (!this.pointerInScrollArea(pointer)) return;
        this.scrollBy(deltaY > 0 ? 1 : -1);
      },
    );
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.beginTouchScroll(pointer));
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.updateTouchScroll(pointer));
    this.input.on("pointerup", () => this.endTouchScroll());
    this.input.on("pointerupoutside", () => this.endTouchScroll());

    this.render();
  }

  private render(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);

    if (this.featsStore === undefined || this.unlocksStore === undefined) {
      this.addToContent(
        this.add
          .text(
            CANVAS_W / 2,
            300,
            "Destiny is quiet.",
            textStyle({
              fontSize: "22px",
              color: TEXT.textMuted,
              fontStyle: "italic",
            }),
          )
          .setOrigin(0.5, 0.5),
      );
      return;
    }

    const profile = this.unlocksStore.getProfile();
    const balance = computeSpendableBalance(this.featsStore.getProfile(), profile);
    const used = activeWeight(profile.activated, UNLOCK_CATALOG);
    const pips = "●".repeat(used) + "○".repeat(Math.max(0, DESTINY_BUDGET - used));

    this.addPanel(44, 74, 812, 28);
    this.addText(64, 80, `✦ ${balance} Fragments`, 14, TEXT.textReward, true);
    this.addText(600, 80, `Destiny ${pips} ${used}/${DESTINY_BUDGET}`, 14, "#d6b15c", true);

    const rows = Math.ceil(UNLOCK_CATALOG.length / 2);
    const maxOffset = Math.max(0, rows - VISIBLE_ROWS);
    this.scrollOffset = Math.min(this.scrollOffset, maxOffset);
    const visible = UNLOCK_CATALOG.slice(
      this.scrollOffset * 2,
      (this.scrollOffset + VISIBLE_ROWS) * 2,
    );

    visible.forEach((def, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      this.renderCard(
        def,
        GRID_LEFT + col * (CARD_W + GRID_GAP_X),
        GRID_TOP + row * (CARD_H + GRID_GAP_Y),
        balance,
        profile,
      );
    });

    if (maxOffset > 0) {
      this.addText(
        780,
        84,
        `${this.scrollOffset + 1}-${Math.min(this.scrollOffset + VISIBLE_ROWS, rows)} of ${rows}`,
        11,
        TEXT.textMuted,
      );
      if (this.scrollOffset > 0) {
        const up = this.add
          .text(842, GRID_TOP, "▲", textStyle({ fontSize: "13px", color: "#d6b15c" }))
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => this.scrollBy(-1));
        this.addToContent(up);
      }
      if (this.scrollOffset < maxOffset) {
        const down = this.add
          .text(
            842,
            GRID_TOP + VISIBLE_ROWS * (CARD_H + GRID_GAP_Y) - 28,
            "▼",
            textStyle({ fontSize: "13px", color: "#d6b15c" }),
          )
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => this.scrollBy(1));
        this.addToContent(down);
      }
    }
  }

  private renderCard(
    def: UnlockDefinition,
    x: number,
    y: number,
    balance: number,
    profile: ReturnType<UnlocksStore["getProfile"]>,
  ): void {
    const card = this.add.container(x, y);
    const panel = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x15101d, 0.94).setOrigin(0, 0);
    panel.setStrokeStyle(1, 0x5f4b2a, 0.85);
    panel.setRounded(8);
    card.add(panel);

    const artKey = `unlock/${def.id}`;
    if (this.textures.exists(artKey)) {
      const image = this.add.image(50, 50, artKey).setDisplaySize(76, 76);
      card.add(image);
    } else {
      const placeholder = this.add.rectangle(50, 50, 76, 76, 0x22172a, 1);
      placeholder.setStrokeStyle(1, 0xd6b15c, 0.35);
      card.add(placeholder);
      card.add(
        this.add
          .text(50, 42, "✦", textStyle({ fontSize: "22px", color: "#d6b15c" }))
          .setOrigin(0.5, 0.5),
      );
    }

    card.add(
      this.add.text(
        102,
        14,
        def.name,
        textStyle({
          fontSize: "15px",
          color: TEXT.textWorldTitle,
          fontStyle: "bold",
          wordWrap: { width: 190 },
        }),
      ),
    );
    card.add(
      this.add.text(
        314,
        15,
        "●".repeat(def.destinyWeight),
        textStyle({
          fontSize: "13px",
          color: "#d6b15c",
        }),
      ),
    );
    card.add(
      this.add.text(
        102,
        38,
        effectSummary(def),
        textStyle({
          fontSize: "12px",
          color: TEXT.textReward,
          wordWrap: { width: 246 },
        }),
      ),
    );
    card.add(
      this.add.text(
        102,
        56,
        def.description,
        textStyle({
          fontSize: "11px",
          color: TEXT.textMuted,
          fontStyle: "italic",
          wordWrap: { width: 246 },
        }),
      ),
    );
    card.add(
      this.add.text(
        102,
        98,
        `✦ ${def.cost}`,
        textStyle({
          fontSize: "12px",
          color: TEXT.textLight,
          fontStyle: "bold",
        }),
      ),
    );

    const state = unlockCardState(def, profile.purchased, balance);
    if (state === "owned") {
      card.add(
        this.add.text(
          170,
          96,
          "✓ owned",
          textStyle({
            fontSize: "12px",
            color: TEXT.textReward,
            fontStyle: "bold",
          }),
        ),
      );
      this.addActivationToggle(card, def, profile);
    } else if (state === "affordable") {
      card.add(this.createCardButton(314, 106, "Buy", () => this.confirmPurchase(def)));
    } else {
      card.add(
        this.add.text(
          286,
          96,
          "locked",
          textStyle({
            fontSize: "12px",
            color: TEXT.textMuted,
          }),
        ),
      );
    }

    this.addToContent(card);
  }

  private addActivationToggle(
    card: Phaser.GameObjects.Container,
    def: UnlockDefinition,
    profile: ReturnType<UnlocksStore["getProfile"]>,
  ): void {
    const active = profile.activated.includes(def.id);
    const enabled = active || canActivate(def, profile.activated, UNLOCK_CATALOG);
    const label = active ? "◉ ACTIVE" : "○ inactive";
    const color = active ? TEXT.textReward : enabled ? "#d6b15c" : TEXT.textMuted;
    const toggle = this.add.text(
      274,
      96,
      label,
      textStyle({
        fontSize: "12px",
        color,
        fontStyle: active ? "bold" : "",
      }),
    );
    if (enabled) {
      toggle
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.toggleActive(def, !active));
    } else {
      toggle.setAlpha(0.45);
    }
    card.add(toggle);
  }

  private toggleActive(def: UnlockDefinition, active: boolean): void {
    const result = this.unlocksStore?.setActive(def.id, active);
    if (result !== "ok") {
      this.messageText?.setText(
        result === "over-budget"
          ? "The thread will not hold more weight."
          : "That Blessing is not owned.",
      );
    } else {
      this.messageText?.setText("");
    }
    this.render();
  }

  private confirmPurchase(def: UnlockDefinition): void {
    this.confirmOverlay?.destroy(true);
    const overlay = this.add.container(CANVAS_W / 2, CANVAS_H / 2).setDepth(1000);
    const bg = this.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x050409, 0.82);
    bg.setInteractive();
    const panel = this.add.rectangle(0, 0, 520, 220, 0x15101d, 0.98);
    panel.setStrokeStyle(2, 0xd6b15c, 0.95);
    panel.setRounded(8);
    const body = this.add
      .text(
        0,
        -52,
        `Buy ${def.name} for ✦ ${def.cost}?`,
        textStyle({
          fontSize: "18px",
          color: TEXT.textLight,
          align: "center",
          wordWrap: { width: 430 },
        }),
      )
      .setOrigin(0.5, 0.5);
    overlay.add([bg, panel, body]);
    overlay.add([
      this.createOverlayButton(-82, 62, "Cancel", () => overlay.destroy(true)),
      this.createOverlayButton(82, 62, "Buy", () => {
        overlay.destroy(true);
        this.purchase(def);
      }),
    ]);
    this.confirmOverlay = overlay;
  }

  private purchase(def: UnlockDefinition): void {
    const result = this.unlocksStore?.purchase(def.id);
    switch (result) {
      case "ok":
        this.messageText?.setText(`${def.name} remembered.`);
        break;
      case "already-owned":
        this.messageText?.setText("Already owned.");
        break;
      case "insufficient-fragments":
      default:
        this.messageText?.setText("Not enough Fragments.");
        break;
    }
    this.render();
  }

  private scrollBy(delta: number): void {
    const rows = Math.ceil(UNLOCK_CATALOG.length / 2);
    const maxOffset = Math.max(0, rows - VISIBLE_ROWS);
    const next = Phaser.Math.Clamp(this.scrollOffset + delta, 0, maxOffset);
    if (next === this.scrollOffset) return;
    this.scrollOffset = next;
    this.render();
  }

  private beginTouchScroll(pointer: Phaser.Input.Pointer): void {
    if (this.confirmOverlay !== undefined || !this.pointerInScrollArea(pointer)) return;
    this.touchScrollLastY = pointer.y;
    this.touchScrollRemainder = 0;
  }

  private updateTouchScroll(pointer: Phaser.Input.Pointer): void {
    if (this.touchScrollLastY === undefined || !pointer.isDown) return;

    this.touchScrollRemainder += this.touchScrollLastY - pointer.y;
    this.touchScrollLastY = pointer.y;

    const rows = Math.trunc(this.touchScrollRemainder / TOUCH_SCROLL_THRESHOLD);
    if (rows === 0) return;

    this.touchScrollRemainder -= rows * TOUCH_SCROLL_THRESHOLD;
    this.scrollBy(rows);
  }

  private endTouchScroll(): void {
    this.touchScrollLastY = undefined;
    this.touchScrollRemainder = 0;
  }

  private pointerInScrollArea(pointer: Phaser.Input.Pointer): boolean {
    return pointer.y >= GRID_TOP && pointer.y <= GRID_TOP + VISIBLE_ROWS * (CARD_H + GRID_GAP_Y);
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): Button {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 86, 32, 0x15101d, 0.9);
    bg.setStrokeStyle(1, 0xd6b15c, 0.8);
    bg.setRounded(6);
    bg.setInteractive({ useHandCursor: true });
    const text = this.add
      .text(
        0,
        -8,
        label,
        textStyle({
          fontSize: "14px",
          color: "#d6b15c",
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0);
    container.add([bg, text]);
    bg.on("pointerover", () => container.setScale(1.05));
    bg.on("pointerout", () => container.setScale(1));
    bg.on("pointerdown", onClick);
    return { container, bg };
  }

  private createCardButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 76, 28, 0x0d0a12, 0.95);
    bg.setStrokeStyle(1, 0xd6b15c, 0.9);
    bg.setRounded(6);
    bg.setInteractive({ useHandCursor: true });
    const text = this.add
      .text(
        0,
        -7,
        label,
        textStyle({
          fontSize: "12px",
          color: "#d6b15c",
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0);
    container.add([bg, text]);
    bg.on("pointerdown", onClick);
    return container;
  }

  private createOverlayButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 90, 34, 0x0d0a12, 0.95);
    bg.setStrokeStyle(1, 0xd6b15c, 0.9);
    bg.setRounded(6);
    bg.setInteractive({ useHandCursor: true });
    const text = this.add
      .text(
        0,
        -8,
        label,
        textStyle({
          fontSize: "14px",
          color: "#d6b15c",
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0);
    container.add([bg, text]);
    bg.on("pointerdown", onClick);
    return container;
  }

  private addPanel(x: number, y: number, w: number, h: number): void {
    const panel = this.add.rectangle(x, y, w, h, 0x15101d, 0.92).setOrigin(0, 0);
    panel.setStrokeStyle(1, 0x5f4b2a, 0.85);
    panel.setRounded(8);
    this.addToContent(panel);
  }

  private addText(
    x: number,
    y: number,
    value: string,
    size: number,
    color: string,
    bold = false,
  ): void {
    this.addToContent(
      this.add.text(
        x,
        y,
        value,
        textStyle({
          fontSize: `${size}px`,
          color,
          fontStyle: bold ? "bold" : "",
          wordWrap: { width: 780 },
        }),
      ),
    );
  }

  private addToContent(child: Phaser.GameObjects.GameObject): void {
    this.content?.add(child);
  }
}

function effectSummary(def: UnlockDefinition): string {
  switch (def.effect.type) {
    case "startingStat":
      return `Start with +${def.effect.amount} ${def.effect.stat}`;
    case "handSizeBonus":
      return `Hand size +${def.effect.amountPerAct} per act`;
    case "minResourcePerTurn":
      return `${def.effect.resource} floor ${def.effect.floor}`;
    case "keywordDamageBonus":
      return `Keyword bonuses +${def.effect.amount}`;
    case "starterDeckOverride":
      return "Footballer starter deck";
    case "actReward":
      return `Choose 1 of ${def.effect.offeredCount} after acts`;
  }
}
