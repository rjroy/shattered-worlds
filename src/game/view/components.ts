/**
 * Reusable Phaser UI components shared across the table view.
 *
 * CommonLabel is a text label on a nine-slice backing panel; CommonButton is
 * the interactive variant. Both are plain Phaser game objects with no
 * knowledge of GameState — callers construct them and pass in text/style.
 */
import Phaser from "phaser";
import { TooltipCopy } from "../../core/view/effectTooltips";
import { addTooltip } from "./TooltipView";

const LABEL_TEXTURE = "text-back";
const LABEL_SIDE_INSET = 50;
const LABEL_EDGE_INSET = 100;
const BUTTON_TEXTURE = "button-back";
const BUTTON_SIDE_INSET = 30;
const BUTTON_EDGE_INSET = 30;

export class CommonLabel extends Phaser.GameObjects.Container {
  protected txtBg: Phaser.GameObjects.NineSlice;
  protected label: Phaser.GameObjects.Text;
  protected readonly horizontalPadding = 24;
  protected readonly verticalPadding = 14;
  protected readonly sideInset: number;
  protected readonly edgeInset: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    textStyle: Phaser.Types.GameObjects.Text.TextStyle,
    backingTexture = LABEL_TEXTURE,
    sideInset = LABEL_SIDE_INSET,
    edgeInset = LABEL_EDGE_INSET,
  ) {
    super(scene, x, y);

    this.sideInset = sideInset;
    this.edgeInset = edgeInset;

    this.txtBg = scene.add
      .nineslice(
        0,
        0,
        backingTexture,
        undefined,
        30,
        20,
        this.sideInset,
        this.sideInset,
        this.edgeInset,
        this.edgeInset,
      )
      .setOrigin(0.5, 0.5)
      .setTint(0x777777);
    this.add(this.txtBg);

    this.label = scene.add.text(0, 0, text, textStyle);
    this.label.setOrigin(0.5, 0.5);
    this.resizeBacking();

    this.add(this.label);
    this.setPosition(x, y);
    scene.add.existing(this);
  }

  setText(text: string): void {
    this.label.setText(text);
    this.resizeBacking();
  }

  protected resizeBacking(): void {
    const insettedWidth = this.label.width + 2 * this.sideInset;
    const insettedHeight = this.label.height + 2 * this.edgeInset;
    const finalWidth = this.label.width + this.horizontalPadding;
    const finalHeight = this.label.height + this.verticalPadding;

    const scaleX = finalWidth / insettedWidth;
    const scaleY = finalHeight / insettedHeight;

    const width = finalWidth / scaleX;
    const height = finalHeight / scaleY;

    this.txtBg.setSize(width, height).setScale(scaleX, scaleY);
  }

  setTint(tint: string): void {
    const tintColor = Phaser.Display.Color.HexStringToColor(tint);
    const colorWheel = Phaser.Display.Color.HSVColorWheel(tintColor.s, tintColor.v);

    if (colorWheel.length > 0) {
      const bgIdx = Math.floor(tintColor.h * colorWheel.length);
      const txtIdx = Math.floor((tintColor.h + 0.33) * colorWheel.length) % colorWheel.length;
      if (colorWheel[bgIdx] && colorWheel[txtIdx]) {
        const bgColor = Phaser.Display.Color.IntegerToColor(colorWheel[bgIdx].color).darken(
          75,
        ).color;
        const txtColor = Phaser.Display.Color.IntegerToColor(colorWheel[txtIdx].color).lighten(
          50,
        ).color;
        this.txtBg.setTint(bgColor);
        this.label.setTint(txtColor);
        return;
      }
    }
    this.txtBg.setTint(0x777777);
    this.label.setTint(0xffffff);
  }

  getBgHeight(): number {
    return this.txtBg.height;
  }

  setTooltip(copy: TooltipCopy): void {
    addTooltip(this.scene, this.txtBg, copy);
  }
}

export class CommonButton extends CommonLabel {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    textStyle: Phaser.Types.GameObjects.Text.TextStyle,
  ) {
    super(scene, x, y, text, textStyle, BUTTON_TEXTURE, BUTTON_SIDE_INSET, BUTTON_EDGE_INSET);

    this.txtBg.setTint(0x8f5c30);
    this.resizeBacking();
    this.txtBg.setInteractive({ useHandCursor: true });
    this.txtBg.on("pointerover", () => this.setButtonState("hover"));
    this.txtBg.on("pointerout", () => this.setButtonState("idle"));
    this.txtBg.on("pointerdown", () => this.setButtonState("down"));
    this.txtBg.on("pointerup", () => this.setButtonState("hover"));
  }

  setText(text: string): void {
    super.setText(text);
    this.resizeBacking();
  }

  private setButtonState(state: "idle" | "hover" | "down"): void {
    const pressedOffset = state === "down" ? 2 : 0;
    this.txtBg.y = pressedOffset;
    this.label.y = pressedOffset;

    if (state === "hover") {
      this.txtBg.setTint(0xb4793f);
      return;
    }

    if (state === "down") {
      this.txtBg.setTint(0x704321);
      return;
    }

    this.txtBg.setTint(0x8f5c30);
  }

  on(event: string, callback: () => void): this {
    if (this.txtBg !== undefined) {
      this.txtBg.on(event, callback);
    }
    return this;
  }

  disableInteractive(): this {
    if (this.txtBg !== undefined) {
      this.txtBg.disableInteractive();
    }
    return this;
  }

  setInteractive(config?: Phaser.Types.Input.InputConfiguration): this {
    if (this.txtBg !== undefined) {
      this.txtBg.setInteractive(config);
    }
    return this;
  }
}
