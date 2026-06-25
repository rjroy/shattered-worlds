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
const LABEL_SIDE_INSET = 4;
const LABEL_EDGE_INSET = 2;
const BUTTON_TEXTURE = "button-back";
const BUTTON_SIDE_INSET = 16;
const BUTTON_EDGE_INSET = 12;

export class CommonLabel extends Phaser.GameObjects.Container {
  protected txtBg: Phaser.GameObjects.NineSlice;
  protected label: Phaser.GameObjects.Text;
  protected readonly horizontalPadding = 24;
  protected readonly verticalPadding = 14;

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

    this.txtBg = scene.add
      .nineslice(0, 0, backingTexture, undefined, 30, 20, sideInset, sideInset, edgeInset, edgeInset)
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
    this.txtBg.setSize(
      this.label.width + this.horizontalPadding,
      this.label.height + this.verticalPadding,
    );
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
  private readonly buttonShadow: Phaser.GameObjects.NineSlice;
  private readonly buttonRim: Phaser.GameObjects.NineSlice;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    textStyle: Phaser.Types.GameObjects.Text.TextStyle,
  ) {
    super(scene, x, y, text, textStyle, BUTTON_TEXTURE, BUTTON_SIDE_INSET, BUTTON_EDGE_INSET);

    this.buttonShadow = scene.add
      .nineslice(
        0,
        4,
        BUTTON_TEXTURE,
        undefined,
        30,
        20,
        BUTTON_SIDE_INSET,
        BUTTON_SIDE_INSET,
        BUTTON_EDGE_INSET,
        BUTTON_EDGE_INSET,
      )
      .setOrigin(0.5, 0.5)
      .setTint(0x17110d);
    this.buttonShadow.alpha = 0.78;
    this.addAt(this.buttonShadow, 0);

    this.buttonRim = scene.add
      .nineslice(
        0,
        1,
        BUTTON_TEXTURE,
        undefined,
        30,
        20,
        BUTTON_SIDE_INSET,
        BUTTON_SIDE_INSET,
        BUTTON_EDGE_INSET,
        BUTTON_EDGE_INSET,
      )
      .setOrigin(0.5, 0.5)
      .setTint(0xd7b071);
    this.buttonRim.alpha = 0.9;
    this.addAt(this.buttonRim, 1);

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

  protected resizeBacking(): void {
    super.resizeBacking();
    if (this.buttonShadow === undefined || this.buttonRim === undefined) return;

    this.buttonRim.setSize(this.txtBg.width + 7, this.txtBg.height + 7);
    this.buttonShadow.setSize(this.txtBg.width + 7, this.txtBg.height + 7);
  }

  private setButtonState(state: "idle" | "hover" | "down"): void {
    const pressedOffset = state === "down" ? 2 : 0;
    this.txtBg.y = pressedOffset;
    this.label.y = pressedOffset;
    this.buttonRim.y = pressedOffset + 1;

    if (state === "hover") {
      this.txtBg.setTint(0xb4793f);
      this.buttonRim.setTint(0xf2cf88);
      this.buttonShadow.alpha = 0.9;
      return;
    }

    if (state === "down") {
      this.txtBg.setTint(0x704321);
      this.buttonRim.setTint(0xb8894c);
      this.buttonShadow.alpha = 0.55;
      return;
    }

    this.txtBg.setTint(0x8f5c30);
    this.buttonRim.setTint(0xd7b071);
    this.buttonShadow.alpha = 0.78;
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
