import Phaser from "phaser";
import type { Card, CardTemplate, CardTemplateId } from "../../core/index";
import { compileEffect } from "../../core/view/effectGlyphs";
import { parseKeyword } from "../../core/index";
import { addEffectLines } from "./effectLineView";
import { CARD_FACE, CANVAS_H, CANVAS_W, TABLE_LAYOUT } from "./layout";
import { TEXT, textStyle, getRealityPalette, selectCardFrontKey } from "./presentation";
import type { VisualTheme } from "./themes/theme";

export interface ActBoonChoiceOption {
  readonly templateId: CardTemplateId;
  readonly template: Readonly<CardTemplate> | undefined;
}

export interface ActBoonChoiceViewConfig {
  readonly theme: VisualTheme;
  readonly options: readonly ActBoonChoiceOption[];
  readonly onChoose: (templateId: CardTemplateId) => void;
  readonly resolveTheme: (worldId: string) => VisualTheme;
}

const CARD_GAP = 26;
const OPTION_Y = 326;

export class ActBoonChoiceView extends Phaser.GameObjects.Container {
  readonly missingTemplateIds: readonly CardTemplateId[];

  constructor(scene: Phaser.Scene, config: ActBoonChoiceViewConfig) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(TABLE_LAYOUT.modalDepth + 20);

    const shield = scene.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x050505, 0.78);
    shield.setOrigin(0, 0);
    shield.setInteractive();
    this.add(shield);

    const panel = scene.add
      .nineslice(CANVAS_W / 2, CANVAS_H / 2, "text-back", undefined, 700, 460, 32, 32, 16, 16)
      .setTint(0x3a3630);
    this.add(panel);

    const title = scene.add.text(
      CANVAS_W / 2,
      108,
      "Choose a Fortune boon",
      textStyle({
        fontSize: "24px",
        color: getRealityPalette(config.theme, "title"),
        fontStyle: "bold",
      }),
    );
    title.setOrigin(0.5, 0.5);
    this.add(title);

    const copy = scene.add.text(
      CANVAS_W / 2,
      141,
      "Pick one temporary card. It goes directly to your hand.",
      textStyle({
        fontSize: "14px",
        color: getRealityPalette(config.theme, "text"),
      }),
    );
    copy.setOrigin(0.5, 0.5);
    this.add(copy);

    const missing = config.options
      .filter((option) => option.template === undefined)
      .map((option) => option.templateId);
    this.missingTemplateIds = missing;

    if (missing.length > 0) {
      const error = scene.add.text(
        CANVAS_W / 2,
        CANVAS_H / 2,
        `Fortune boon templates are missing:\n${missing.join(", ")}`,
        textStyle({
          fontSize: "16px",
          color: getRealityPalette(config.theme, "cancel"),
          fontStyle: "bold",
          align: "center",
        }),
      );
      error.setOrigin(0.5, 0.5);
      this.add(error);
      scene.children.bringToTop(this);
      return;
    }

    const count = config.options.length;
    const totalWidth = count * CARD_FACE.width + Math.max(0, count - 1) * CARD_GAP;
    const startX = CANVAS_W / 2 - totalWidth / 2 + CARD_FACE.width / 2;

    config.options.forEach((option, index) => {
      if (option.template === undefined) return;
      const x = startX + index * (CARD_FACE.width + CARD_GAP);
      const face = new TemplateCardFace(
        scene,
        x,
        OPTION_Y,
        option.templateId,
        option.template,
        config.theme,
        config.resolveTheme,
      );
      face.setInteractive({ useHandCursor: true });
      face.on("pointerdown", () => config.onChoose(option.templateId));
      this.add(face);

      const keyLabel = scene.add.text(
        x,
        OPTION_Y + CARD_FACE.height / 2 + 22,
        `${index + 1}`,
        textStyle({
          fontSize: "13px",
          color: getRealityPalette(config.theme, "text"),
          fontStyle: "bold",
        }),
      );
      keyLabel.setOrigin(0.5, 0.5);
      this.add(keyLabel);
    });

    scene.children.bringToTop(this);
  }
}

class TemplateCardFace extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    templateId: CardTemplateId,
    template: Readonly<CardTemplate>,
    theme: VisualTheme,
    resolveTheme: (worldId: string) => VisualTheme,
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.setSize(CARD_FACE.width, CARD_FACE.height);

    const previewCard: Card =
      template.kind === "player"
        ? {
            kind: "player",
            id: `template:${templateId}`,
            templateId,
            name: template.name,
            insetKey: template.insetKey,
            sourceWorldId: theme.worldId,
            effect: template.effect,
            energyCost: template.energyCost ?? 0,
            keywords: (template.keywords ?? []).map(parseKeyword),
            ...(template.exhaust === undefined ? {} : { exhaust: template.exhaust }),
          }
        : {
            kind: "world",
            id: `template:${templateId}`,
            templateId,
            name: template.name,
            insetKey: template.insetKey,
            cost: template.cost,
            keywords: template.keywords.map(parseKeyword),
            discardable: template.discardable,
            canExile: template.canExile ?? true,
            onDiscarded: template.onDiscarded,
            onCleared: template.onCleared,
            onEndOfTurn: template.onEndOfTurn,
            onPartialClear: template.onPartialClear,
          };

    const cardImg = scene.add.image(0, 0, selectCardFrontKey(previewCard, theme, resolveTheme));
    cardImg.setDisplaySize(CARD_FACE.width, CARD_FACE.height);
    this.add(cardImg);

    const frame = scene.add.rectangle(1, 1, CARD_FACE.width - 2, CARD_FACE.height - 2, 0x000000, 0);
    frame.setStrokeStyle(2, 0xf3d180, 0.8);
    frame.setRounded(10);
    this.add(frame);

    if (template.insetKey !== undefined && template.insetKey !== "") {
      const insetImg = scene.add.image(CARD_FACE.inset.x, CARD_FACE.inset.y, template.insetKey);
      insetImg.setOrigin(0.5, 1);
      const ratio = Math.max(
        CARD_FACE.inset.width / Math.max(1, insetImg.width),
        CARD_FACE.inset.height / Math.max(1, insetImg.height),
      );
      insetImg.setDisplaySize(insetImg.width * ratio, insetImg.height * ratio);
      this.add(insetImg);
    }

    this.addCenteredText(-CARD_FACE.height / 2 + 8, template.name, "16px", TEXT.textLight, true);

    if (template.kind === "player") {
      const keywords = template.keywords ?? [];
      if (keywords.length > 0) {
        this.addCenteredText(-CARD_FACE.height / 2 + 24, keywords.join(" · "), "9px", TEXT.textKeyword);
      }

      const effectBlock = addEffectLines(scene, compileEffect(template.effect, theme.worldId), {
        maxWidth: CARD_FACE.width - 18,
        baseColor: TEXT.textLight,
        background: { color: 0x000000, alpha: 0.8 },
        warnLabel: template.name,
      });
      effectBlock.container.setPosition(0, -CARD_FACE.height / 2 + (keywords.length > 0 ? 38 : 30));
      this.add(effectBlock.container);

      const cost = template.energyCost ?? 0;
      const costText = scene.add.text(
        -CARD_FACE.width / 2 + 16,
        CARD_FACE.height / 2 - 22,
        String(cost),
        textStyle({ fontSize: "20px", color: TEXT.textLight, fontStyle: "bold" }),
      );
      costText.setOrigin(0.5, 0.5);
      this.add(costText);
    } else {
      this.addCenteredText(0, "World card", "13px", TEXT.textLight, true);
    }
  }

  private addCenteredText(
    y: number,
    content: string,
    fontSize: string,
    color: string,
    bold = false,
  ): Phaser.GameObjects.Text {
    const style: Phaser.Types.GameObjects.Text.TextStyle = { fontSize, color };
    if (bold) style.fontStyle = "bold";
    const text = this.scene.add.text(0, y, content, textStyle(style));
    text.setOrigin(0.5, 0);
    if (text.width > CARD_FACE.width - 12) {
      text.setScale((CARD_FACE.width - 12) / text.width);
    }
    this.add(text);
    return text;
  }
}
