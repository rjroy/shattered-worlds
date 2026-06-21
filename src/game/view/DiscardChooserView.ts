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
const LIST_TOP = 168;
const INSET_SLOT_W = 28;

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

  constructor(scene: Phaser.Scene, config: DiscardChooserViewConfig) {
    super(scene, 0, 0);
    this.config = config;
    scene.add.existing(this);
    this.setDepth(TABLE_LAYOUT.modalDepth + 20);

    const listH = config.cards.length * ROW_H + Math.max(0, config.cards.length - 1) * ROW_GAP;
    // Panel spans the header (above LIST_TOP), the row list, and the footer.
    const panelH = Math.min(CANVAS_H - 40, Math.max(260, LIST_TOP - 60 + listH + 96));

    const shield = scene.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x050505, 0.78);
    shield.setOrigin(0, 0);
    shield.setInteractive();
    this.add(shield);

    const panel = scene.add
      .nineslice(
        CANVAS_W / 2,
        CANVAS_H / 2,
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

    config.cards.forEach((card, index) => {
      this.addRow(scene, card, LIST_TOP + index * (ROW_H + ROW_GAP));
    });

    this.addFooter(scene, LIST_TOP + listH + 18);

    this.refreshConfirm();
    scene.children.bringToTop(this);
  }

  private addRow(scene: Phaser.Scene, card: Card, y: number): void {
    const rowW = PANEL_W - 60;
    const left = CANVAS_W / 2 - rowW / 2;

    const border = scene.add
      .rectangle(CANVAS_W / 2, y + ROW_H / 2, rowW, ROW_H, 0x0b0710, 0.55)
      .setRounded(6);
    border.setStrokeStyle(2, this.config.theme.frameStyle.targetBorder, 0.0);
    border.setInteractive({ useHandCursor: true });
    border.on("pointerdown", () => this.toggle(card.id));
    this.add(border);
    this.rowBorders.set(card.id, border);

    // Empty inset slot (deferred art): a thin placeholder frame on the left.
    const insetSlot = scene.add
      .rectangle(left + 6 + INSET_SLOT_W / 2, y + ROW_H / 2, INSET_SLOT_W, ROW_H - 10, 0x000000, 0.3)
      .setRounded(3);
    insetSlot.setStrokeStyle(1, this.config.theme.frameStyle.ringAccent, 0.4);
    this.add(insetSlot);

    const cost = scene.add.text(
      left + 6 + INSET_SLOT_W + 10,
      y + ROW_H / 2,
      `${cardCost(card)}`,
      textStyle({ fontSize: "15px", color: TEXT.textCost, fontStyle: "bold" }),
    );
    cost.setOrigin(0, 0.5);
    this.add(cost);

    const name = scene.add.text(
      left + 6 + INSET_SLOT_W + 34,
      y + ROW_H / 2,
      card.name,
      textStyle({ fontSize: "15px", color: getRealityPalette(this.config.theme, "title") }),
    );
    name.setOrigin(0, 0.5);
    this.add(name);

    const state = cardStateLabel(card);
    if (state !== "") {
      const stateText = scene.add.text(
        left + rowW - 10,
        y + ROW_H / 2,
        state,
        textStyle({ fontSize: "11px", color: TEXT.textHeld, fontStyle: "italic" }),
      );
      stateText.setOrigin(1, 0.5);
      this.add(stateText);
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

  /** Test seam: the current pick order. */
  get selectedIds(): readonly string[] {
    return [...this.picks];
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
