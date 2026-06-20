/**
 * Reusable confirmation modal for a previewed action. ActionConfirmationView
 * owns the Phaser panel, the consequence-line stack, and the Cancel / Commit
 * buttons. It is a PURE view: it takes a title, the preview's already
 * concealment-masked summary lines, and onCommit / onCancel callbacks. It does
 * NOT import the runtime, session, or dispatch — the caller (TableScene) owns
 * those and supplies the callbacks.
 *
 * Lifecycle mirrors RunSummaryView/HelpOverlayView: constructed once, hidden by
 * default, shown via `show(...)`, hidden via `hide()`. A full-canvas interactive
 * backdrop swallows clicks behind the modal so the underlying table cannot be
 * touched while a confirmation is up.
 */
import Phaser from "phaser";
import { textStyle, TEXT } from "./presentation";
import { CANVAS_W, CANVAS_H, TABLE_LAYOUT } from "./layout";

export interface ActionConfirmationOptions {
  readonly title: string;
  readonly lines: readonly string[];
  readonly onCommit: () => void;
  readonly onCancel: () => void;
}

// Layout constants. The panel is sized for the worst case (MAX_LINES filled)
// and stays comfortably within the 900x600 canvas: a 520-wide panel centered
// horizontally, and a height that tops out well under CANVAS_H.
const PANEL_WIDTH = 520;
const LINE_HEIGHT = 22;
const LINE_START_Y = -120;
// Cap visible consequence lines so a long summary cannot overflow the canvas.
// When more lines exist, the last visible slot becomes a "+N more" indicator.
// MAX_LINES * LINE_HEIGHT plus the title/button chrome keeps the panel < 600px.
const MAX_LINES = 12;

export class ActionConfirmationView extends Phaser.GameObjects.Container {
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly commitBtn: Phaser.GameObjects.Text;
  private readonly cancelBtn: Phaser.GameObjects.Text;

  // Per-show consequence-line objects. Rebuilt each show() and destroyed on
  // hide()/next show() so a second show never stacks leftovers.
  private lineObjects: Phaser.GameObjects.Text[] = [];

  // The live callbacks for the current show. Nulled out the instant either
  // fires so the exactly-once guard holds: a double-click on Commit, or a
  // Cancel after a Commit, finds them null and does nothing.
  private onCommit: (() => void) | null = null;
  private onCancel: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, CANVAS_W / 2, CANVAS_H / 2);
    scene.add.existing(this);
    this.setDepth(TABLE_LAYOUT.confirmDepth);
    this.setVisible(false);

    // Blocking backdrop FIRST so it sits behind the panel but captures any
    // stray click aimed at the table underneath. Positioned in container-local
    // space: the container is centered, so the backdrop offsets back to (0,0).
    this.backdrop = scene.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x05060a, 0.72);
    this.backdrop.setInteractive();
    this.add(this.backdrop);

    this.panel = scene.add.rectangle(0, 0, PANEL_WIDTH, 360, 0x12101a, 0.97);
    this.panel.setStrokeStyle(2, 0xd6b15c, 0.95);
    this.panel.setRounded(8);
    this.add(this.panel);

    this.titleText = scene.add
      .text(
        0,
        -150,
        "",
        textStyle({
          fontSize: "22px",
          color: TEXT.textLight,
          fontStyle: "bold",
          align: "center",
          wordWrap: { width: PANEL_WIDTH - 40 },
        }),
      )
      .setOrigin(0.5, 0.5);
    this.add(this.titleText);

    this.cancelBtn = scene.add
      .text(
        -110,
        148,
        "[ Cancel ]",
        textStyle({
          fontSize: "16px",
          color: TEXT.textMuted,
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0.5);
    this.cancelBtn.setInteractive({ useHandCursor: true });
    this.cancelBtn.on("pointerdown", () => this.cancel());
    this.add(this.cancelBtn);

    this.commitBtn = scene.add
      .text(
        110,
        148,
        "[ Commit ]",
        textStyle({
          fontSize: "16px",
          color: TEXT.textReward,
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0.5);
    this.commitBtn.setInteractive({ useHandCursor: true });
    this.commitBtn.on("pointerdown", () => this.commit());
    this.add(this.commitBtn);
  }

  /** Whether the modal is currently displayed. */
  get isOpen(): boolean {
    return this.visible;
  }

  show(opts: ActionConfirmationOptions): void {
    this.clearLines();
    this.onCommit = opts.onCommit;
    this.onCancel = opts.onCancel;
    this.titleText.setText(opts.title);

    const visibleLines = this.cappedLines(opts.lines);
    visibleLines.forEach((line, index) => {
      const lineText = this.scene.add
        .text(
          0,
          LINE_START_Y + index * LINE_HEIGHT,
          line,
          textStyle({
            fontSize: "14px",
            color: TEXT.textMuted,
            align: "center",
            wordWrap: { width: PANEL_WIDTH - 48 },
          }),
        )
        .setOrigin(0.5, 0.5);
      this.lineObjects.push(lineText);
      this.add(lineText);
    });

    this.setVisible(true);
    this.scene.children.bringToTop(this);
  }

  /** Cap the consequence lines to MAX_LINES, replacing overflow with "+N more". */
  private cappedLines(lines: readonly string[]): string[] {
    if (lines.length <= MAX_LINES) return [...lines];
    const kept = lines.slice(0, MAX_LINES - 1);
    const overflow = lines.length - kept.length;
    return [...kept, `+${overflow} more`];
  }

  private commit(): void {
    const callback = this.onCommit;
    // Null BOTH callbacks before firing so a rapid second click (or the other
    // button) cannot resolve again. Exactly once per show.
    this.onCommit = null;
    this.onCancel = null;
    this.hide();
    callback?.();
  }

  private cancel(): void {
    const callback = this.onCancel;
    this.onCommit = null;
    this.onCancel = null;
    this.hide();
    callback?.();
  }

  hide(): void {
    this.setVisible(false);
    this.clearLines();
    this.onCommit = null;
    this.onCancel = null;
  }

  /** Alias for hide(), matching the close() idiom used by other overlays. */
  close(): void {
    this.hide();
  }

  private clearLines(): void {
    for (const obj of this.lineObjects) {
      this.remove(obj, true);
    }
    this.lineObjects = [];
  }
}
