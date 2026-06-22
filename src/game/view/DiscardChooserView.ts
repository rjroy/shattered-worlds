/**
 * Tidal Archive discard-recall chooser (REQ-TIDAL-14).
 *
 * A compact overlay listing the player's `playerDiscard` cards so the player can
 * pick which to return to the top of their deck for `ReturnPlayerDiscardToTop`
 * (Mark the Shelf, Shelf Map). Each row shows the card name, cost, an (empty)
 * inset slot, and its modified/exhaust state. Selection is bounded by the
 * effect's `min`/`max`; Confirm is gated on `>= min` picks and `<= max` is
 * enforced at toggle time. Mirrors `BoonChoiceView`'s self-contained overlay
 * shape (shield + panel + interactive children + callbacks) rather than driving
 * the in-hand connector flow, since discard cards are not rendered as targetable
 * card objects on the table.
 *
 * When the discard pile holds more cards than fit in the panel, the row list
 * pages a fixed window (`MAX_VISIBLE_ROWS`) and the footer stays pinned at the
 * bottom of the panel, so Confirm/Cancel are always reachable. This mirrors the
 * row-paging scroll the Destiny scene uses: wheel, Up/Down keys, and touch-drag
 * all move the window by whole rows, and the visible rows are re-rendered.
 * Selection survives paging because picks live in `this.picks`, not in the row
 * objects, so a pick made off-screen is re-applied when its row scrolls back in.
 *
 * The empty-pile / `min: 0` auto-skip is handled by the SCENE before this view
 * is ever constructed (see selection.ts § empty-pile flow); this view always
 * opens with at least one row. For `min: 0` it still allows confirming with zero
 * picks (the "done" affordance) so the player can decline an optional recall.
 *
 * Pure-Phaser apply layer (renderer side of the boundary).
 */
import Phaser from "phaser";
import type { Card } from "../../core/index";
import { CANVAS_H, CANVAS_W, TABLE_LAYOUT } from "./layout";
import { textStyle, getRealityPalette, TEXT } from "./presentation";
import type { VisualTheme } from "./themes/theme";

export interface DiscardChooserOption {
  readonly card: Card;
}

export interface DiscardChooserViewConfig {
  readonly theme: VisualTheme;
  /** Cards currently in playerDiscard, in pile order. */
  readonly cards: readonly Card[];
  readonly min: number;
  readonly max: number;
  /** Called with the chosen ids (in selection order) when the player confirms. */
  readonly onConfirm: (ids: readonly string[]) => void;
  readonly onCancel: () => void;
}

const PANEL_W = 560;
const ROW_H = 36;
const ROW_GAP = 6;
const ROW_STRIDE = ROW_H + ROW_GAP;
const LIST_TOP = 168;
const INSET_SLOT_W = 28;
/** Most rows shown at once; longer piles page within this window. */
const MAX_VISIBLE_ROWS = 7;
/** Touch-drag distance (px) that advances the window by one row. */
const TOUCH_SCROLL_THRESHOLD = ROW_STRIDE;
/** x of the page-scroll arrows, just inside the right panel edge. */
const ARROW_X = CANVAS_W / 2 + PANEL_W / 2 - 24;

/** Compact one-line description of a card's recall-relevant instance state. */
function cardStateLabel(card: Card): string {
  const flags: string[] = [];
  if (card.kind === "player") {
    if (card.modified === true) flags.push("modified");
    if (card.exhaust === true) flags.push("exhaust");
    if (card.frozen !== undefined && card.frozen > 0) flags.push("frozen");
  }
  return flags.length === 0 ? "" : flags.join(" · ");
}

/** A card's display cost: player cards use energyCost, world cards use cost. */
function cardCost(card: Card): number {
  return card.kind === "player" ? card.energyCost : card.cost;
}

export class DiscardChooserView extends Phaser.GameObjects.Container {
  private readonly picks: string[] = [];
  private readonly rowBorders = new Map<string, Phaser.GameObjects.Rectangle>();
  private confirmLabel!: Phaser.GameObjects.Text;
  private readonly config: DiscardChooserViewConfig;

  /** Number of rows shown at once, and where the visible window starts. */
  private readonly visibleRows: number;
  private readonly maxOffset: number;
  private scrollOffset = 0;
  private listContainer?: Phaser.GameObjects.Container;

  /** Touch-drag scroll bookkeeping (mirrors DestinyScene). */
  private touchScrollLastY: number | undefined;
  private touchScrollRemainder = 0;

  /** Bound scene-input handlers, retained so destroy() can detach them. */
  private readonly onWheel: (
    pointer: Phaser.Input.Pointer,
    over: unknown,
    dx: number,
    dy: number,
  ) => void;
  private readonly onKeyUp: () => void;
  private readonly onKeyDown: () => void;
  private readonly onPointerDown: (pointer: Phaser.Input.Pointer) => void;
  private readonly onPointerMove: (pointer: Phaser.Input.Pointer) => void;
  private readonly onPointerUp: () => void;

  constructor(scene: Phaser.Scene, config: DiscardChooserViewConfig) {
    super(scene, 0, 0);
    this.config = config;
    scene.add.existing(this);
    this.setDepth(TABLE_LAYOUT.modalDepth + 20);

    this.visibleRows = Math.min(config.cards.length, MAX_VISIBLE_ROWS);
    this.maxOffset = Math.max(0, config.cards.length - this.visibleRows);

    const visibleListH = this.visibleRows * ROW_H + Math.max(0, this.visibleRows - 1) * ROW_GAP;
    const footerY = LIST_TOP + visibleListH + 30;
    // Panel spans the header (title/copy), the fixed row window, and the footer.
    const panelTop = 76;
    const panelBottom = footerY + 30;
    const panelH = panelBottom - panelTop;

    const shield = scene.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x050505, 0.78);
    shield.setOrigin(0, 0);
    shield.setInteractive();
    this.add(shield);

    const panel = scene.add
      .nineslice(
        CANVAS_W / 2,
        (panelTop + panelBottom) / 2,
        "text-back",
        undefined,
        PANEL_W,
        panelH,
        32,
        32,
        16,
        16,
      )
      .setTint(0x33302b);
    this.add(panel);

    const title = scene.add.text(
      CANVAS_W / 2,
      96,
      "Mark the Shelf",
      textStyle({
        fontSize: "22px",
        color: getRealityPalette(config.theme, "title"),
        fontStyle: "bold",
      }),
    );
    title.setOrigin(0.5, 0.5);
    this.add(title);

    const range = config.min === config.max ? `${config.max}` : `${config.min}–${config.max}`;
    const noun = config.max === 1 ? "card" : "cards";
    const copy = scene.add.text(
      CANVAS_W / 2,
      126,
      `Choose ${range} ${noun} from your discard to return to the top of your deck.` +
        (config.min === 0 ? " (optional)" : ""),
      textStyle({
        fontSize: "13px",
        color: getRealityPalette(config.theme, "text"),
        align: "center",
        wordWrap: { width: PANEL_W - 60 },
      }),
    );
    copy.setOrigin(0.5, 0);
    this.add(copy);

    this.addFooter(scene, footerY);
    this.renderRows(scene);

    // Page-scroll input. Guarded for the headless test scene (no `input`); the
    // bound handlers are detached in destroy() to avoid leaking across opens.
    this.onWheel = (pointer, _over, _dx, dy: number) => {
      if (!this.pointerInScrollArea(pointer)) return;
      this.scrollBy(dy > 0 ? 1 : -1);
    };
    this.onKeyUp = () => this.scrollBy(-1);
    this.onKeyDown = () => this.scrollBy(1);
    this.onPointerDown = (pointer) => this.beginTouchScroll(pointer);
    this.onPointerMove = (pointer) => this.updateTouchScroll(pointer);
    this.onPointerUp = () => this.endTouchScroll();

    const input = scene.input;
    if (input !== undefined) {
      input.on("wheel", this.onWheel);
      input.on("pointerdown", this.onPointerDown);
      input.on("pointermove", this.onPointerMove);
      input.on("pointerup", this.onPointerUp);
      input.on("pointerupoutside", this.onPointerUp);
      input.keyboard?.on("keydown-UP", this.onKeyUp);
      input.keyboard?.on("keydown-DOWN", this.onKeyDown);
    }

    this.refreshConfirm();
    scene.children.bringToTop(this);
  }

  /** (Re)build the visible row window and its page-scroll affordances. */
  private renderRows(scene: Phaser.Scene): void {
    this.listContainer?.destroy(true);
    this.rowBorders.clear();
    const list = scene.add.container(0, 0);
    this.listContainer = list;
    this.add(list);

    const visible = this.config.cards.slice(this.scrollOffset, this.scrollOffset + this.visibleRows);
    visible.forEach((card, index) => {
      this.addRow(scene, list, card, LIST_TOP + index * ROW_STRIDE);
    });

    if (this.maxOffset > 0) {
      this.addScrollAffordances(scene, list);
    }
  }

  private addScrollAffordances(scene: Phaser.Scene, list: Phaser.GameObjects.Container): void {
    const accent = getRealityPalette(this.config.theme, "title");
    const windowH = this.visibleRows * ROW_STRIDE;

    const start = this.scrollOffset + 1;
    const end = this.scrollOffset + this.visibleRows;
    const count = scene.add
      .text(
        CANVAS_W / 2,
        LIST_TOP + windowH - 4,
        `${start}–${end} of ${this.config.cards.length}`,
        textStyle({ fontSize: "11px", color: TEXT.textMuted }),
      )
      .setOrigin(0.5, 0.5);
    list.add(count);

    if (this.scrollOffset > 0) {
      const up = scene.add
        .text(ARROW_X, LIST_TOP + 6, "▲", textStyle({ fontSize: "14px", color: accent }))
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.scrollBy(-1));
      list.add(up);
    }
    if (this.scrollOffset < this.maxOffset) {
      const down = scene.add
        .text(ARROW_X, LIST_TOP + windowH - 22, "▼", textStyle({ fontSize: "14px", color: accent }))
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.scrollBy(1));
      list.add(down);
    }
  }

  private addRow(
    scene: Phaser.Scene,
    list: Phaser.GameObjects.Container,
    card: Card,
    y: number,
  ): void {
    const rowW = PANEL_W - 60;
    const left = CANVAS_W / 2 - rowW / 2;
    const picked = this.picks.includes(card.id);

    const border = scene.add
      .rectangle(
        CANVAS_W / 2,
        y + ROW_H / 2,
        rowW,
        ROW_H,
        picked ? this.config.theme.frameStyle.pickedBorder : 0x0b0710,
        picked ? 0.22 : 0.55,
      )
      .setRounded(6);
    border.setStrokeStyle(2, this.config.theme.frameStyle.pickedBorder, picked ? 1 : 0);
    border.setInteractive({ useHandCursor: true });
    border.on("pointerdown", () => this.toggle(card.id));
    list.add(border);
    this.rowBorders.set(card.id, border);

    // Empty inset slot (deferred art): a thin placeholder frame on the left.
    const insetSlot = scene.add
      .rectangle(left + 6 + INSET_SLOT_W / 2, y + ROW_H / 2, INSET_SLOT_W, ROW_H - 10, 0x000000, 0.3)
      .setRounded(3);
    insetSlot.setStrokeStyle(1, this.config.theme.frameStyle.ringAccent, 0.4);
    list.add(insetSlot);

    const cost = scene.add.text(
      left + 6 + INSET_SLOT_W + 10,
      y + ROW_H / 2,
      `${cardCost(card)}`,
      textStyle({ fontSize: "15px", color: TEXT.textCost, fontStyle: "bold" }),
    );
    cost.setOrigin(0, 0.5);
    list.add(cost);

    const name = scene.add.text(
      left + 6 + INSET_SLOT_W + 34,
      y + ROW_H / 2,
      card.name,
      textStyle({ fontSize: "15px", color: getRealityPalette(this.config.theme, "title") }),
    );
    name.setOrigin(0, 0.5);
    list.add(name);

    const state = cardStateLabel(card);
    if (state !== "") {
      const stateText = scene.add.text(
        left + rowW - 10,
        y + ROW_H / 2,
        state,
        textStyle({ fontSize: "11px", color: TEXT.textHeld, fontStyle: "italic" }),
      );
      stateText.setOrigin(1, 0.5);
      list.add(stateText);
    }
  }

  private addFooter(scene: Phaser.Scene, y: number): void {
    const confirm = scene.add
      .rectangle(CANVAS_W / 2 + 78, y, 140, 38, 0x122a25, 0.92)
      .setRounded(8);
    confirm.setStrokeStyle(1, this.config.theme.frameStyle.selectedBorder, 0.85);
    confirm.setInteractive({ useHandCursor: true });
    confirm.on("pointerdown", () => this.onConfirmClick());
    this.add(confirm);

    this.confirmLabel = scene.add
      .text(
        CANVAS_W / 2 + 78,
        y,
        "Confirm",
        textStyle({
          fontSize: "15px",
          color: getRealityPalette(this.config.theme, "confirm"),
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0.5);
    this.add(this.confirmLabel);

    const cancel = scene.add
      .rectangle(CANVAS_W / 2 - 78, y, 140, 38, 0x2a1414, 0.9)
      .setRounded(8);
    cancel.setStrokeStyle(1, this.config.theme.frameStyle.discardBorder, 0.85);
    cancel.setInteractive({ useHandCursor: true });
    cancel.on("pointerdown", () => this.config.onCancel());
    this.add(cancel);

    const cancelLabel = scene.add
      .text(
        CANVAS_W / 2 - 78,
        y,
        "Cancel",
        textStyle({
          fontSize: "15px",
          color: getRealityPalette(this.config.theme, "cancel"),
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0.5);
    this.add(cancelLabel);
  }

  /** Toggle a pick on/off, enforcing the max cap (max===1 replaces). */
  private toggle(id: string): void {
    const at = this.picks.indexOf(id);
    if (at >= 0) {
      this.picks.splice(at, 1);
    } else if (this.picks.length >= this.config.max) {
      if (this.config.max === 1) {
        this.picks.length = 0;
        this.picks.push(id);
      } else {
        return; // at capacity, multi-pick — ignore
      }
    } else {
      this.picks.push(id);
    }
    this.refreshSelection();
    this.refreshConfirm();
  }

  private refreshSelection(): void {
    for (const [id, border] of this.rowBorders) {
      const picked = this.picks.includes(id);
      border.setStrokeStyle(2, this.config.theme.frameStyle.pickedBorder, picked ? 1 : 0);
      border.setFillStyle(picked ? this.config.theme.frameStyle.pickedBorder : 0x0b0710, picked ? 0.22 : 0.55);
    }
  }

  private refreshConfirm(): void {
    const satisfied = this.picks.length >= this.config.min;
    this.confirmLabel.setText(this.picks.length === 0 && this.config.min === 0 ? "Done" : "Confirm");
    this.confirmLabel.setAlpha(satisfied ? 1 : TEXT.dimAlpha);
  }

  private onConfirmClick(): void {
    if (this.picks.length < this.config.min) return;
    this.config.onConfirm([...this.picks]);
  }

  /** Page the visible window by whole rows, clamped to the pile. */
  private scrollBy(delta: number): void {
    const next = Phaser.Math.Clamp(this.scrollOffset + delta, 0, this.maxOffset);
    if (next === this.scrollOffset) return;
    this.scrollOffset = next;
    this.renderRows(this.scene);
  }

  private beginTouchScroll(pointer: Phaser.Input.Pointer): void {
    if (!this.pointerInScrollArea(pointer)) return;
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
    if (this.maxOffset === 0) return false;
    const windowH = this.visibleRows * ROW_STRIDE;
    return pointer.y >= LIST_TOP && pointer.y <= LIST_TOP + windowH;
  }

  override destroy(fromScene?: boolean): void {
    const input = this.scene?.input;
    if (input !== undefined) {
      input.off("wheel", this.onWheel);
      input.off("pointerdown", this.onPointerDown);
      input.off("pointermove", this.onPointerMove);
      input.off("pointerup", this.onPointerUp);
      input.off("pointerupoutside", this.onPointerUp);
      input.keyboard?.off("keydown-UP", this.onKeyUp);
      input.keyboard?.off("keydown-DOWN", this.onKeyDown);
    }
    super.destroy(fromScene);
  }

  /** Test seam: the current pick order. */
  get selectedIds(): readonly string[] {
    return [...this.picks];
  }

  /** Test seam: ids of the rows currently rendered, top to bottom. */
  get visibleCardIds(): readonly string[] {
    return [...this.rowBorders.keys()];
  }

  /** Test seam: page the window by `delta` rows. */
  scrollByRows(delta: number): void {
    this.scrollBy(delta);
  }

  /** Test seam: simulate a pointer click on the row for `id`. */
  clickRow(id: string): void {
    this.toggle(id);
  }

  /** Test seam: simulate clicking the Confirm/Done button. */
  clickConfirm(): void {
    this.onConfirmClick();
  }

  /** Test seam: simulate clicking the Cancel button. */
  clickCancel(): void {
    this.config.onCancel();
  }

  /** Test seam: the live Confirm/Done button label. */
  get confirmLabelText(): string {
    return this.confirmLabel.text;
  }
}
