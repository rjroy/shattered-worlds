import Phaser from "phaser";
import type { BoonChoiceSource, Card, CardTemplate, CardTemplateId } from "../../core/index";
import { parseKeyword } from "../../core/index";
import { CARD_FACE, CANVAS_H, CANVAS_W, TABLE_LAYOUT } from "./layout";
import { textStyle, getRealityPalette } from "./presentation";
import { FONTS } from "./fonts";
import type { VisualTheme } from "./themes/theme";
import { CardView } from "./CardView";

export interface BoonChoiceOption {
  readonly templateId: CardTemplateId;
  readonly template: Readonly<CardTemplate> | undefined;
}

export interface BoonChoiceViewConfig {
  readonly theme: VisualTheme;
  readonly source: BoonChoiceSource;
  readonly bToDiscard: boolean;
  readonly options: readonly BoonChoiceOption[];
  readonly title?: string;
  readonly copy?: string;
  readonly onChoose: (templateId: CardTemplateId) => void;
  readonly resolveTheme: (worldId: string) => VisualTheme;
}

const CARD_GAP = 26;
const OPTION_Y = 326;

function previewCardFromTemplate(
  templateId: CardTemplateId,
  template: Readonly<CardTemplate>,
  worldId: string,
): Card {
  if (template.kind === "player") {
    return {
      kind: "player",
      id: `template:${templateId}`,
      templateId,
      name: template.name,
      insetKey: template.insetKey,
      sourceWorldId: worldId,
      effect: template.effect,
      canDestroy: template.canDestroy ?? true,
      energyCost: template.energyCost ?? 0,
      exhaust: template.exhaust ?? false,
      keywords: (template.keywords ?? []).map(parseKeyword),
      rarity: template.rarity ?? "common",
    };
  }

  return {
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
    rarity: template.rarity ?? "common",
  };
}

export class BoonChoiceView extends Phaser.GameObjects.Container {
  readonly missingTemplateIds: readonly CardTemplateId[];

  constructor(scene: Phaser.Scene, config: BoonChoiceViewConfig) {
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
      config.title ?? "Choose a boon",
      textStyle({
        fontFamily: FONTS.title,
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
      config.copy ??
        (config.bToDiscard
          ? "Pick one temporary card. It goes to your discard pile."
          : "Pick one temporary card. It goes directly to your hand."),
      textStyle({
        fontFamily: FONTS.body,
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
        `Boon templates are missing:\n${missing.join(", ")}`,
        textStyle({
          fontFamily: FONTS.body,
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
      const previewCard = previewCardFromTemplate(
        option.templateId,
        option.template,
        config.theme.worldId,
      );
      const face = new CardView(
        scene,
        previewCard,
        x,
        OPTION_Y,
        config.theme,
        config.resolveTheme,
      );
      face.setDepth(0);
      face.setSize(CARD_FACE.width, CARD_FACE.height);
      face.setInteractive({ useHandCursor: true });
      face.on("pointerdown", () => config.onChoose(option.templateId));
      this.add(face);

      const keyLabel = scene.add.text(
        x,
        OPTION_Y + CARD_FACE.height / 2 + 22,
        `${index + 1}`,
        textStyle({
          fontFamily: FONTS.monospace,
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
