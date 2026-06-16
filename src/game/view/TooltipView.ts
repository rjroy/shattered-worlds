import Phaser from "phaser";
import type { TooltipCopy } from "../../core/view/effectTooltips";
import { CANVAS_H, CANVAS_W } from "./layout";
import { TEXT, textStyle } from "./presentation";

const TOOLTIP_DEPTH = 2000;
const TOOLTIP_DELAY_MS = 450;
const TOOLTIP_OFFSET = { x: 18, y: 16 };
const TOOLTIP_MAX_W = 210;
const TOOLTIP_PAD_X = 9;
const TOOLTIP_PAD_Y = 7;
const TOOLTIP_GAP = 3;

type TooltipTarget = Phaser.GameObjects.GameObject & {
  setInteractive?: (config?: Phaser.Types.Input.InputConfiguration) => unknown;
  on?: (event: string, callback: (...args: unknown[]) => void) => unknown;
  parentContainer?: unknown;
};

type TooltipScene = Phaser.Scene & { cardTooltipView?: TooltipView };

export class TooltipView extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private showEvent: Phaser.Time.TimerEvent | undefined;
  private activeCopy: TooltipCopy | undefined;
  private pointerX = 0;
  private pointerY = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(TOOLTIP_DEPTH);
    this.setVisible(false);

    this.bg = scene.add.rectangle(0, 0, 10, 10, 0x080a12, 0.94);
    this.bg.setOrigin(0, 0);
    this.bg.setStrokeStyle(1, 0x88ccff, 0.72);
    this.bg.setRounded(6);
    this.add(this.bg);

    this.titleText = scene.add.text(
      TOOLTIP_PAD_X,
      TOOLTIP_PAD_Y,
      "",
      textStyle({ fontSize: "12px", color: TEXT.textKeyword, fontStyle: "bold" }),
    );
    this.titleText.setOrigin(0, 0);
    this.add(this.titleText);

    this.bodyText = scene.add.text(
      TOOLTIP_PAD_X,
      TOOLTIP_PAD_Y,
      "",
      textStyle({
        fontSize: "11px",
        color: TEXT.textLight,
        wordWrap: { width: TOOLTIP_MAX_W },
        lineSpacing: 2,
      }),
    );
    this.bodyText.setOrigin(0, 0);
    this.add(this.bodyText);
  }

  static forScene(scene: Phaser.Scene): TooltipView {
    const tooltipScene = scene as TooltipScene;
    if (tooltipScene.cardTooltipView === undefined) {
      tooltipScene.cardTooltipView = new TooltipView(scene);
    }
    return tooltipScene.cardTooltipView;
  }

  register(target: TooltipTarget, copy: TooltipCopy): void {
    target.setInteractive?.({ useHandCursor: true });
    target.on?.("pointerover", (pointer: unknown) => this.schedule(copy, pointer));
    target.on?.("pointermove", (pointer: unknown) => this.track(pointer));
    target.on?.("pointerout", () => this.hide());
    target.on?.("pointerdown", (...args: unknown[]) => {
      this.hide();
      this.forwardCardPointerDown(target, args);
    });
    target.on?.("destroy", () => this.hide());
  }

  private schedule(copy: TooltipCopy, pointer: unknown): void {
    this.activeCopy = copy;
    this.track(pointer);
    this.cancelShowEvent();
    this.showEvent = this.scene.time.delayedCall(TOOLTIP_DELAY_MS, () => this.show(copy));
  }

  private track(pointer: unknown): void {
    const p = pointer as { x?: number; y?: number; worldX?: number; worldY?: number };
    this.pointerX = p.worldX ?? p.x ?? this.pointerX;
    this.pointerY = p.worldY ?? p.y ?? this.pointerY;
    if (this.visible && this.activeCopy !== undefined) {
      this.place();
    }
  }

  private show(copy: TooltipCopy): void {
    if (this.activeCopy !== copy) return;
    this.titleText.setText(copy.title);
    this.bodyText.setText(copy.body);
    this.bodyText.setY(TOOLTIP_PAD_Y + this.titleText.height + TOOLTIP_GAP);

    const contentW = Math.max(this.titleText.width, this.bodyText.width);
    const contentH = this.titleText.height + TOOLTIP_GAP + this.bodyText.height;
    this.bg.setSize(contentW + TOOLTIP_PAD_X * 2, contentH + TOOLTIP_PAD_Y * 2);
    this.place();
    this.setVisible(true);
  }

  hide(): void {
    this.activeCopy = undefined;
    this.cancelShowEvent();
    this.setVisible(false);
  }

  private place(): void {
    const width = this.bg.width;
    const height = this.bg.height;
    let x = this.pointerX + TOOLTIP_OFFSET.x;
    let y = this.pointerY + TOOLTIP_OFFSET.y;
    if (x + width > CANVAS_W - 6) x = this.pointerX - width - TOOLTIP_OFFSET.x;
    if (y + height > CANVAS_H - 6) y = this.pointerY - height - TOOLTIP_OFFSET.y;
    this.setPosition(Math.max(6, x), Math.max(6, y));
  }

  private cancelShowEvent(): void {
    this.showEvent?.remove(false);
    this.showEvent = undefined;
  }

  private forwardCardPointerDown(target: TooltipTarget, args: readonly unknown[]): void {
    let parent = target.parentContainer as
      | { parentContainer?: unknown; cardId?: unknown; emit?: (event: string, ...args: unknown[]) => void }
      | undefined;
    while (parent !== undefined) {
      if (typeof parent.cardId === "string" && typeof parent.emit === "function") {
        parent.emit("pointerdown", ...args);
        return;
      }
      parent = parent.parentContainer as typeof parent | undefined;
    }
  }
}

export function addTooltip(
  scene: Phaser.Scene,
  target: TooltipTarget,
  copy: TooltipCopy,
): void {
  if (target.setInteractive === undefined || target.on === undefined) return;
  TooltipView.forScene(scene).register(target, copy);
}
