import Phaser from "phaser";
import { textStyle, TEXT } from "./presentation";
import { CANVAS_W, CANVAS_H } from "./layout";
import { WORLD_CONSTS } from "../../core/engine/world";
import { worldDisplayManifest } from "../../data/worldDisplayManifest";
import { worldHelpManifest } from "../../data/worldHelpManifest";
import type { CardEffect } from "../../core/index";
import { compileEffect, type IconId } from "../../core/view/effectGlyphs";
import { EFFECT_ICON_TEXTURES } from "./effectLineLayout";
import { addEffectLines } from "./effectLineView";

/** Full-screen help overlay with tab/page navigation, hidden by default. */
export class HelpOverlayView extends Phaser.GameObjects.Container {
  private readonly pages: Phaser.GameObjects.Container[] = [];
  private readonly tabButtons: Phaser.GameObjects.Container[] = [];
  private activePage = 0;

  constructor(scene: Phaser.Scene, worldId: string, totalActs: number) {
    super(scene, CANVAS_W / 2, CANVAS_H / 2);
    scene.add.existing(this);
    this.setDepth(1000);
    this.setVisible(false);

    const bg = scene.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x080a12, 0.92);
    bg.setInteractive();
    this.add(bg);

    const helpData = worldHelpManifest[worldId];
    if (helpData === undefined) {
      throw new Error(`No help entry for worldId: ${worldId}`);
    }
    const displayData = worldDisplayManifest[worldId];
    if (displayData === undefined) {
      throw new Error(`No display entry for worldId: ${worldId}`);
    }

    type PageSpec = {
      tab: string;
      title: string;
      subtitle: string;
      build: (page: Phaser.GameObjects.Container) => void;
    };

    const title = scene.add.text(
      -380,
      -265,
      "HELP",
      textStyle({
        fontSize: "11px",
        color: TEXT.textKeyword,
        fontStyle: "bold",
      }),
    );
    this.add(title);

    function addText(
      parent: Phaser.GameObjects.Container,
      x: number,
      y: number,
      text: string,
      style: Phaser.Types.GameObjects.Text.TextStyle,
      originX = 0,
      originY = 0,
    ): Phaser.GameObjects.Text {
      const obj = scene.add.text(x, y, text, textStyle(style));
      obj.setOrigin(originX, originY);
      parent.add(obj);
      return obj;
    }

    function addPanel(
      parent: Phaser.GameObjects.Container,
      x: number,
      y: number,
      w: number,
      h: number,
    ): Phaser.GameObjects.Rectangle {
      const panel = scene.add.rectangle(x, y, w, h, 0x101725, 0.86);
      panel.setStrokeStyle(1, 0x31415d, 0.85);
      panel.setRounded(8);
      parent.add(panel);
      return panel;
    }

    function addCallout(
      parent: Phaser.GameObjects.Container,
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      label: string,
      detail: string,
      color: string,
    ): void {
      const colorInt = Phaser.Display.Color.HexStringToColor(color).color;
      const line = scene.add.graphics();
      line.lineStyle(2, colorInt, 0.9);
      line.lineBetween(fromX, fromY, toX, toY);
      line.fillStyle(colorInt, 1);
      line.fillCircle(fromX, fromY, 4);
      parent.add(line);

      addText(parent, toX, toY - 22, label, {
        fontSize: "13px",
        color,
        fontStyle: "bold",
      });
      addText(parent, toX, toY - 4, detail, {
        fontSize: "12px",
        color: TEXT.textMuted,
        wordWrap: { width: 200 },
        lineSpacing: 2,
      });
    }

    function addHelpCard(
      parent: Phaser.GameObjects.Container,
      x: number,
      y: number,
      kind: "hazard" | "player",
    ): void {
      const cardW = 170;
      const cardH = 222;
      const card = scene.add.rectangle(x, y, cardW, cardH, 0x161d2b, 1);
      card.setStrokeStyle(2, kind === "hazard" ? 0x8a4c42 : 0x4c658f, 1);
      card.setRounded(12);
      parent.add(card);

      function addEffectBlock(
        effect: CardEffect,
        blockX: number,
        blockY: number,
        color: string,
        leadIcon?: IconId,
      ): number {
        const effectOpts = {
          maxWidth: cardW - 22,
          baseColor: color,
          fontSize: 10,
          background: { color: 0x000000, alpha: 0.72 },
          warnLabel: `help ${kind}`,
        };
        const block = addEffectLines(
          scene,
          compileEffect(effect),
          leadIcon === undefined ? effectOpts : { ...effectOpts, leadIcon },
        );
        if (block.height === 0) {
          block.container.destroy();
          return 0;
        }
        block.container.setPosition(blockX, blockY);
        parent.add(block.container);
        return block.height;
      }

      addText(
        parent,
        x,
        y - 96,
        kind === "hazard" ? "Zombie" : "Explore",
        {
          fontSize: "16px",
          color: TEXT.textLight,
          fontStyle: "bold",
          wordWrap: { width: cardW - 18 },
          align: "center",
        },
        0.5,
        0,
      );

      if (kind === "hazard") {
        const zombieEachTurn: CardEffect = {
          kind: "Sequence",
          steps: [
            { kind: "Damage", amount: 1 },
            { kind: "AddWorldCardToDeck", template: "Zombie" },
          ],
        };

        addText(
          parent,
          x,
          y - 68,
          "Creature",
          {
            fontSize: "11px",
            color: TEXT.textKeyword,
          },
          0.5,
          0,
        );

        let currY = y - 34;
        currY += addEffectBlock(zombieEachTurn, x - 6, currY, TEXT.textHeld, "eachTurn") + 5;
        currY +=
          addEffectBlock(
            { kind: "Damage", amount: 5 },
            x - 6,
            currY,
            TEXT.textPenalty,
            "onDiscard",
          ) + 5;
        currY +=
          addEffectBlock(
            { kind: "GainEnergy", amount: 1 },
            x - 6,
            currY,
            TEXT.textReward,
            "onClear",
          ) + 5;
        addEffectBlock(
          { kind: "Damage", amount: 2 },
          x - 6,
          currY,
          TEXT.textPenalty,
          "onPartialClear",
        );

        const ring = scene.add.circle(x + 60, y + 78, 22, 0x000000, 0.25);
        ring.setStrokeStyle(4, 0xffcc44, 0.9);
        parent.add(ring);
        addText(
          parent,
          x + 60,
          y + 63,
          "4",
          {
            fontSize: "24px",
            color: TEXT.textCost,
            fontStyle: "bold",
          },
          0.5,
          0,
        );
        addText(
          parent,
          x + 60,
          y + 88,
          "to clear",
          {
            fontSize: "8px",
            color: TEXT.textMuted,
          },
          0.5,
          0,
        );
        addText(
          parent,
          x,
          y + 94,
          "click to discard",
          {
            fontSize: "9px",
            color: TEXT.textDiscard,
            fontStyle: "bold",
            backgroundColor: "#000000",
          },
          0.5,
          0,
        );
      } else {
        addEffectBlock(
          {
            kind: "DealProgress",
            base: 1,
            bonus: { tag: "Hidden", amount: 1 },
          },
          x,
          y - 62,
          TEXT.textLight,
        );
        const inset = scene.add.rectangle(x, y + 42, 132, 78, 0x27364f, 1);
        inset.setStrokeStyle(1, 0x88ccff, 0.65);
        inset.setRounded(5);
        parent.add(inset);
        addText(
          parent,
          x,
          y + 20,
          "Card art",
          {
            fontSize: "12px",
            color: TEXT.textMuted,
          },
          0.5,
          0,
        );
        const energy = scene.add.image(x + 60, y - 80, "energy-icon");
        energy.setDisplaySize(30, 30);
        parent.add(energy);
        addText(
          parent,
          x + 60,
          y - 89,
          "1",
          {
            fontSize: "16px",
            color: TEXT.textEnergy,
            fontStyle: "bold",
          },
          0.5,
          0,
        );
      }
    }

    function addStep(
      parent: Phaser.GameObjects.Container,
      x: number,
      y: number,
      n: string,
      text: string,
    ): void {
      const badge = scene.add.circle(x, y, 16, 0x18243a, 1);
      badge.setStrokeStyle(1, 0x88ccff, 0.8);
      parent.add(badge);
      addText(
        parent,
        x,
        y - 9,
        n,
        {
          fontSize: "14px",
          color: TEXT.textKeyword,
          fontStyle: "bold",
        },
        0.5,
        0,
      );
      addText(parent, x + 28, y - 17, text, {
        fontSize: "13px",
        color: TEXT.textMuted,
        wordWrap: { width: 270 },
        lineSpacing: 2,
      });
    }

    // One reference entry on the Icons page: the real icon texture (the same
    // key the card face renders), the effect's short name, and a one-line gloss
    // of what it does. nameColor lets the world-trigger icons echo their card
    // tint (orange Each turn, pink If discarded, green Clear it).
    function addIconRow(
      parent: Phaser.GameObjects.Container,
      x: number,
      y: number,
      iconId: IconId,
      name: string,
      gloss: string,
      wrapWidth = 320,
      nameColor = TEXT.textLight,
    ): void {
      const img = scene.add.image(x, y, EFFECT_ICON_TEXTURES[iconId]);
      img.setDisplaySize(22, 22);
      img.setOrigin(0.5, 0.5);
      parent.add(img);
      addText(parent, x + 20, y - 11, name, {
        fontSize: "12px",
        color: nameColor,
        fontStyle: "bold",
      });
      addText(parent, x + 20, y + 2, gloss, {
        fontSize: "11px",
        color: TEXT.textMuted,
        wordWrap: { width: wrapWidth },
        lineSpacing: 1,
      });
    }

    function addIconSectionHeader(
      parent: Phaser.GameObjects.Container,
      x: number,
      y: number,
      label: string,
    ): void {
      addText(parent, x, y, label, {
        fontSize: "14px",
        color: TEXT.textKeyword,
        fontStyle: "bold",
      });
    }

    const addTab = (index: number, x: number, label: string): void => {
      const tab = scene.add.container(x, -263);
      const bgButton = scene.add.rectangle(0, 0, 102, 25, 0x0b101a, 0.85);
      bgButton.setRounded(7);
      bgButton.setInteractive({ useHandCursor: true });
      const txt = scene.add.text(
        0,
        -7,
        label,
        textStyle({
          fontSize: "11px",
          color: TEXT.textMuted,
          fontStyle: "bold",
        }),
      );
      txt.setOrigin(0.5, 0);
      tab.add(bgButton);
      tab.add(txt);
      tab.setSize(102, 25);
      bgButton.on("pointerup", () => this.updatePage(index));
      this.tabButtons.push(tab);
      this.add(tab);
    };

    const pageSpecs: PageSpec[] = [
      {
        tab: "Turn",
        title: "A turn is a choice between pressure and cleanup",
        subtitle: `Start at ${WORLD_CONSTS.startHp} HP. Gain 1 Energy each turn. Keep your hand under control across ${totalActs} acts.`,
        build: (page) => {
          addPanel(page, -230, 50, 315, 335);
          addStep(
            page,
            -360,
            -72,
            "1",
            `Draw up to ${WORLD_CONSTS.maxHandSize} cards. World cards are hazards; player cards are tools.`,
          );
          addStep(
            page,
            -360,
            10,
            "2",
            "Spend Energy to play player cards. Most useful plays make Progress on hazards.",
          );
          addStep(
            page,
            -360,
            92,
            "3",
            "End the turn when you are done. Hazards still in hand fire their Each turn text.",
          );
          addText(
            page,
            -360,
            170,
            "If the next draw phase gives you no player cards, you lose immediately.",
            {
              fontSize: "12px",
              color: TEXT.textPenalty,
              fontStyle: "bold",
              wordWrap: { width: 300 },
              lineSpacing: 2,
            },
          );

          addPanel(page, 185, 50, 395, 335);
          addText(page, 40, -112, "Hazard reactions use icons", {
            fontSize: "14px",
            color: TEXT.textLight,
            fontStyle: "bold",
            wordWrap: { width: 315 },
          });
          addText(
            page,
            40,
            -84,
            "A hazard row starts with the icon for the moment that can make it fire.",
            {
              fontSize: "13px",
              color: TEXT.textMuted,
              wordWrap: { width: 315 },
              lineSpacing: 2,
            },
          );
          addIconRow(
            page,
            40,
            -28,
            "eachTurn",
            "Ignore",
            "Fires when you end the turn with this hazard still in hand.",
            270,
            TEXT.textHeld,
          );
          addIconRow(
            page,
            40,
            34,
            "onDiscard",
            "Discard",
            "Fires if you click a discardable hazard to throw it away.",
            270,
            TEXT.textPenalty,
          );
          addIconRow(
            page,
            40,
            96,
            "onClear",
            "Clear",
            "Fires when Progress reaches the number in the ring.",
            270,
            TEXT.textReward,
          );
          addIconRow(
            page,
            40,
            158,
            "onPartialClear",
            "Partial clear",
            "Fires on some Progress, but not enough to clear.",
            270,
            TEXT.textDiscard,
          );
        },
      },
      {
        tab: "Hazards",
        title: "Read hazards from top to bottom",
        subtitle: "The face of a world card tells you every consequence before you click it.",
        build: (page) => {
          addHelpCard(page, -235, 45, "hazard");
          addCallout(
            page,
            -203,
            -19,
            -100,
            -84,
            "Keyword",
            "Player cards can deal bonus Progress when this matches.",
            TEXT.textKeyword,
          );
          addCallout(
            page,
            -190,
            30,
            -100,
            -10,
            "Reactions",
            "These rows show how the hazard responds when you discard it, clear it, ignore it, or partially clear it.",
            TEXT.textLight,
          );
          addCallout(
            page,
            -160,
            123,
            -100,
            172,
            "Progress ring",
            "When Progress reaches this number, the hazard clears.",
            TEXT.textCost,
          );

          addPanel(page, 250, 72, 245, 245);
          addText(page, 145, -34, "Targeting tells you what will happen", {
            fontSize: "14px",
            color: TEXT.textLight,
            fontStyle: "bold",
            wordWrap: { width: 210 },
          });
          addText(
            page,
            145,
            0,
            "When you select a player card and hover a legal hazard, " +
              "the preview compares the card text against the hazard cost and keywords.",
            {
              fontSize: "13px",
              color: TEXT.textMuted,
              wordWrap: { width: 210 },
              lineSpacing: 3,
            },
          );
          addText(
            page,
            145,
            102,
            "Example: Explore adds 1 Progress, or 1 Progress against Hidden.",
            {
              fontSize: "13px",
              color: TEXT.textKeyword,
              wordWrap: { width: 210 },
              lineSpacing: 3,
            },
          );
        },
      },
      {
        tab: "Tools",
        title: "Player cards are tools for solving the hazards in front of you",
        subtitle:
          "The cost badge is Energy. The rules text tells you what target, if any, the card needs.",
        build: (page) => {
          addHelpCard(page, -245, 42, "player");
          addCallout(
            page,
            -175,
            -40,
            -100,
            -94,
            "Energy cost",
            "You gain 1 Energy at the start of each turn. Spend it to play stronger cards.",
            TEXT.textEnergy,
          );
          addCallout(
            page,
            -220,
            -10,
            -100,
            -12,
            "Effect text",
            "Progress cards target hazards. " +
              "Draw, heal, energy, and deck cards often play immediately.",
            TEXT.textLight,
          );
          addCallout(
            page,
            -245,
            84,
            -100,
            82,
            "Inset art",
            "Art helps you recognize a card quickly; the rules text remains the source of truth.",
            TEXT.textMuted,
          );

          addPanel(page, 255, 82, 245, 245);
          addText(page, 150, -26, "Matching matters", {
            fontSize: "14px",
            color: TEXT.textLight,
            fontStyle: "bold",
          });
          addText(
            page,
            150,
            6,
            "If a player card says it gets a bonus against Hidden, Creature, or Slow, " +
              "look for that keyword on the hazard row before spending it.",
            {
              fontSize: "13px",
              color: TEXT.textMuted,
              wordWrap: { width: 210 },
              lineSpacing: 3,
            },
          );
          addText(page, 150, 110, "Some cards will allow you to choose effects.", {
            fontSize: "13px",
            color: TEXT.textKeyword,
            wordWrap: { width: 210 },
            lineSpacing: 3,
          });
          addText(
            page,
            150,
            142,
            "Exhaust cards are destroyed on play, not recycled. One use only.",
            {
              fontSize: "13px",
              color: TEXT.textPenalty,
              wordWrap: { width: 210 },
              lineSpacing: 3,
            },
          );
        },
      },
      {
        tab: "Icons",
        title: "What the card icons mean",
        subtitle: "Here is every effect icon you will see on cards, grouped by what they effect.",
        build: (page) => {
          // Two reference columns. Left edge of each column holds the icon; the
          // name and gloss hang to its right. Column gutter is wide enough that
          // the left glosses (wrap 300) never reach the right column at x=40.
          const leftX = -360;
          const rightX = 40;
          const colWrap = 300;

          addIconSectionHeader(page, leftX, -173, "Make Progress");
          addIconRow(
            page,
            leftX,
            -146,
            "progress",
            "Progress",
            "Add Progress to the hazard you target.",
            colWrap,
          );
          addIconRow(
            page,
            leftX,
            -116,
            "progressAll",
            "Progress · all",
            "Add Progress to every hazard at once.",
            colWrap,
          );
          addIconRow(
            page,
            leftX,
            -86,
            "survive",
            "Survive",
            "Endure the world’s end and press on. (Win)",
            colWrap,
          );

          addIconSectionHeader(page, leftX, -57, "Resources");
          addIconRow(
            page,
            leftX,
            -30,
            "energy",
            "Energy",
            "Gain Energy to spend on more cards.",
            colWrap,
          );
          addIconRow(
            page,
            leftX,
            0,
            "hp",
            "HP",
            "Heal (+) or take damage (−) to your HP.",
            colWrap,
          );
          addIconRow(
            page,
            leftX,
            30,
            "brace",
            "Brace",
            "Prevent random card destroy effects.",
            colWrap,
          );

          addIconSectionHeader(page, leftX, 59, "Either Deck");
          addIconRow(
            page,
            leftX,
            86,
            "addCard",
            "Gain card",
            "Adds a named card to the associated deck.",
            colWrap,
          );
          addIconRow(
            page,
            leftX,
            116,
            "vanish",
            "Vanish",
            "This card exhausts — one use, then it is gone.",
            colWrap,
          );

          addIconSectionHeader(page, rightX, -173, "Player Deck");
          addIconRow(page, rightX, -146, "draw", "Draw", "Draw cards from player deck.", colWrap);
          addIconRow(
            page,
            rightX,
            -116,
            "discard",
            "Discard",
            "Discard a card from your hand.",
            colWrap,
          );
          addIconRow(
            page,
            rightX,
            -86,
            "destroy",
            "Destroy",
            "Remove a card for the rest of the run.",
            colWrap,
          );

          addIconSectionHeader(page, rightX, -57, "World Deck");
          addIconRow(
            page,
            rightX,
            -30,
            "worldDraw",
            "World draw",
            "Draw hazard cards from world deck.",
            colWrap,
          );
          addIconRow(
            page,
            rightX,
            0,
            "exile",
            "Exile",
            "Remove cards off the top of the world deck.",
            colWrap,
          );
          addIconRow(
            page,
            rightX,
            30,
            "return",
            "Return",
            "Send world cards back into the world deck.",
            colWrap,
          );
          addIconRow(
            page,
            rightX,
            60,
            "threat",
            "Threat",
            "Add the main themed hazard to the world deck.",
            colWrap,
          );

          // World-trigger icons lead the colored blocks on a hazard face, so their
          // names echo those tints here. Laid as a full-width strip below the columns.
          addPanel(page, 0, 188, 745, 70);
          addIconSectionHeader(page, leftX, 159, "Hazard Triggers");
          const trigWrap = 150;
          addIconRow(
            page,
            leftX,
            191,
            "eachTurn",
            "Each turn",
            "Fires each turn it stays in hand.",
            trigWrap,
            TEXT.textHeld,
          );
          addIconRow(
            page,
            -178,
            191,
            "onDiscard",
            "If discarded",
            "Fires if you discard the hazard.",
            trigWrap,
            TEXT.textPenalty,
          );
          addIconRow(
            page,
            19,
            191,
            "onClear",
            "Clear it",
            "Fires when you fully clear it.",
            trigWrap,
            TEXT.textReward,
          );
          addIconRow(
            page,
            206,
            191,
            "onPartialClear",
            "Partial clear",
            "Fires on some, but not enough, Progress.",
            trigWrap,
            TEXT.textDiscard,
          );
        },
      },
      {
        tab: "World",
        title: `In this world: ${displayData.name}`,
        subtitle: "These are the mechanics most likely to punish guesses.",
        build: (page) => {
          const leftX = -360;
          let y = -160;
          for (const note of helpData.mechanics) {
            addPanel(page, 0, y + 43, 735, 78);
            addText(page, leftX, y + 12, note.title, {
              fontSize: "14px",
              color: TEXT.textKeyword,
              fontStyle: "bold",
            });
            addText(page, leftX, y + 34, note.detail, {
              fontSize: "12px",
              color: TEXT.textMuted,
              wordWrap: { width: 690 },
              lineSpacing: 2,
            });
            y += 92;
          }
        },
      },
    ];

    pageSpecs.forEach((spec, i) => {
      addTab(i, -245 + i * 112, spec.tab);

      const page = scene.add.container(0, 0);
      addText(page, -380, -226, spec.title, {
        fontSize: "20px",
        color: TEXT.textLight,
        fontStyle: "bold",
        wordWrap: { width: 760 },
      });
      addText(page, -380, -194, spec.subtitle, {
        fontSize: "13px",
        color: TEXT.textMuted,
        wordWrap: { width: 760 },
        lineSpacing: 2,
      });
      spec.build(page);
      this.pages.push(page);
      this.add(page);
    });

    // ---------------------------------------------------------------------------
    // Dismiss button
    // ---------------------------------------------------------------------------

    const closeBtn = scene.add.text(
      380,
      -265,
      "×",
      textStyle({
        fontSize: "20px",
        color: TEXT.textLight,
      }),
    );
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on("pointerup", () => this.setVisible(false));
    this.add(closeBtn);

    const prevBtn = scene.add.text(
      -380,
      255,
      "‹ Previous",
      textStyle({
        fontSize: "14px",
        color: TEXT.textMuted,
      }),
    );
    prevBtn.setInteractive({ useHandCursor: true });
    prevBtn.on("pointerup", () => this.updatePage(this.activePage - 1));
    this.add(prevBtn);

    const nextBtn = scene.add.text(
      292,
      255,
      "Next ›",
      textStyle({
        fontSize: "14px",
        color: TEXT.textMuted,
      }),
    );
    nextBtn.setInteractive({ useHandCursor: true });
    nextBtn.on("pointerup", () => this.updatePage(this.activePage + 1));
    this.add(nextBtn);

    this.updatePage(0);
  }

  private updatePage(nextPage: number): void {
    this.activePage = Phaser.Math.Wrap(nextPage, 0, this.pages.length);
    this.pages.forEach((page, i) => page.setVisible(i === this.activePage));
    this.tabButtons.forEach((button, i) => {
      const bgButton = button.list[0] as Phaser.GameObjects.Rectangle | undefined;
      const label = button.list[1] as Phaser.GameObjects.Text | undefined;
      if (bgButton === undefined || label === undefined) return;
      const selected = i === this.activePage;
      bgButton.setFillStyle(selected ? 0x1d314f : 0x0b101a, selected ? 1 : 0.85);
      bgButton.setStrokeStyle(1, selected ? 0x88ccff : 0x31415d, selected ? 1 : 0.8);
      label.setColor(selected ? TEXT.textLight : TEXT.textMuted);
    });
  }
}
