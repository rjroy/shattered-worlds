import Phaser from "phaser";

import { worldManifest } from "../../data/worldManifest";
import { worldDisplayManifest } from "../../data/worldDisplayManifest";
import { FEAT_CATALOG, computeFragmentBalance } from "../../data/feats/catalog";
import type { RunStatsReader } from "../runtime/runStats";
import type { StatsTransfer, InspectedStatsImport } from "../runtime/statsTransfer";
import type { FeatsStore } from "../runtime/featsProfile";
import { CANVAS_W, CANVAS_H } from "../view/layout";
import { TEXT, textStyle } from "../view/presentation";
import { formatDuration } from "../view/format";
import { addScreenBackdrop } from "../view/screenBackdrop";
import { beginTargeting } from "../interaction/selection";

const VISIBLE_WORLDS = 4;

type Button = {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
};

export class ChronicleScene extends Phaser.Scene {
  private readonly runStats: RunStatsReader | undefined;
  private readonly statsTransfer: StatsTransfer | undefined;
  private readonly featsStore: FeatsStore | undefined;
  private statsContent?: Phaser.GameObjects.Container;
  private featsContent?: Phaser.GameObjects.Container;
  private messageText?: Phaser.GameObjects.Text;
  private confirmOverlay?: Phaser.GameObjects.Container;
  private fileInput?: HTMLInputElement;
  private worldsScrollOffset = 0;

  constructor(runStats?: RunStatsReader, statsTransfer?: StatsTransfer, featsStore?: FeatsStore) {
    super({ key: "Chronicle" });
    this.runStats = runStats;
    this.statsTransfer = statsTransfer;
    this.featsStore = featsStore;
  }

  create(): void {
    this.worldsScrollOffset = 0;
    addScreenBackdrop(this, {
      key: "screen-chronicle",
      veilAlpha: 0.64,
      tint: 0xd8c6ff,
    });
    this.add.text(
      42,
      24,
      "Chronicle",
      textStyle({
        fontSize: "32px",
        color: "#d6b15c",
        fontStyle: "bold",
      }),
    );

    this.createButton(74, 560, "Back", () => this.scene.start("WorldSelect"));
    this.createButton(740, 42, "Export", () => this.exportStats());
    this.createButton(842, 42, "Import", () => this.chooseImportFile());

    this.messageText = this.add
      .text(
        CANVAS_W / 2,
        560,
        "",
        textStyle({
          fontSize: "13px",
          color: TEXT.textPenalty,
          align: "center",
          wordWrap: { width: 560 },
        }),
      )
      .setOrigin(0.5, 0.5);

    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("WorldSelect"));

    this.input.on(
      "wheel",
      (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, deltaY: number) => {
        if (this.statsContent === undefined || !this.statsContent.visible) return;
        const allWorldIds = Object.keys(worldManifest);
        if (allWorldIds.length <= VISIBLE_WORLDS) return;
        if (pointer.y < 222 || pointer.y > 432) return;
        const maxOffset = allWorldIds.length - VISIBLE_WORLDS;
        if (deltaY > 0 && this.worldsScrollOffset < maxOffset) {
          this.worldsScrollOffset += 1;
          this.renderStats();
        } else if (deltaY < 0 && this.worldsScrollOffset > 0) {
          this.worldsScrollOffset -= 1;
          this.renderStats();
        }
      },
    );

    this.renderStats();
    this.renderFeats();

    this.switchTab(this.statsContent);

    this.createButton(280, 42, "Stats", () => this.switchTab(this.statsContent));
    this.createButton(380, 42, "Feats", () => this.switchTab(this.featsContent));
  }

  private switchTab(tabContent?: Phaser.GameObjects.Container): void {
    if (this.statsContent !== undefined) {
      this.statsContent.setVisible(this.statsContent == tabContent);
    }
    if (this.featsContent !== undefined) {
      this.featsContent.setVisible(this.featsContent == tabContent);
    }
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

  private renderStats(): void {
    this.statsContent?.destroy(true);
    this.statsContent = this.add.container(0, 0);

    const lifetime = this.runStats?.lifetime();
    if (lifetime === undefined || lifetime.runs === 0) {
      this.statsContent.add(
        this.add
          .text(
            CANVAS_W / 2,
            285,
            "Nothing is written yet. Step through a Door.",
            textStyle({
              fontSize: "24px",
              color: TEXT.textMuted,
              fontStyle: "italic",
            }),
          )
          .setOrigin(0.5, 0.5),
      );
      return;
    }

    this.addPanel(this.statsContent, 44, 82, 812, 116);
    this.addText(this.statsContent, 64, 100, "Lifetime", 18, "#d6b15c", true);
    const totals = [
      `Runs ${lifetime.runs}`,
      `Wins ${lifetime.wins}`,
      `Losses ${lifetime.losses}`,
      `Abandons ${lifetime.abandoned}`,
      `Turns ${lifetime.turns}`,
      `Cards ${lifetime.cardsPlayed}`,
      `Progress ${lifetime.progressDealt}`,
      `Damage ${lifetime.damageTaken}`,
      `Hazards ${lifetime.hazardsResolved}/${lifetime.hazardsDiscarded}`,
      `Time ${formatDuration(lifetime.durationMs)}`,
    ];
    this.addText(this.statsContent, 64, 132, totals.join("   "), 13, TEXT.textLight);

    this.addPanel(this.statsContent, 44, 222, 812, 210);
    this.addText(this.statsContent, 64, 240, "Worlds", 18, "#d6b15c", true);
    this.addText(this.statsContent, 64, 272, "World", 12, TEXT.textMuted, true);
    this.addText(this.statsContent, 340, 272, "Attempts", 12, TEXT.textMuted, true);
    this.addText(this.statsContent, 430, 272, "Wins", 12, TEXT.textMuted, true);
    this.addText(this.statsContent, 505, 272, "Losses", 12, TEXT.textMuted, true);
    this.addText(this.statsContent, 590, 272, "Abandons", 12, TEXT.textMuted, true);
    this.addText(this.statsContent, 690, 272, "Bests", 12, TEXT.textMuted, true);

    const worldIds = Object.keys(worldManifest);
    const visibleWorldIds = worldIds.slice(
      this.worldsScrollOffset,
      this.worldsScrollOffset + VISIBLE_WORLDS,
    );

    visibleWorldIds.forEach((worldId, visibleIndex) => {
      if (this.statsContent === undefined) {
        console.error("Stats content is undefined when adding stats panel");
        return;
      }
      const y = 304 + visibleIndex * 32;
      const stats = lifetime.byWorld[worldId];
      const display = worldDisplayManifest[worldId];
      const bests = [
        stats?.fewestTurnsWin === undefined ? "" : `${stats.fewestTurnsWin} turns`,
        stats?.mostProgressInRun === undefined ? "" : `${stats.mostProgressInRun} progress`,
      ]
        .filter(Boolean)
        .join("\n");

      this.addPanel(this.statsContent, 56, y - 1, 770, 32, 0x5e2f29);
      this.addText(this.statsContent, 64, y, display?.name ?? worldId, 13, TEXT.textLight);
      this.addText(this.statsContent, 340, y, (stats?.runs ?? 0).toString(), 13, TEXT.textLight);
      this.addText(this.statsContent, 430, y, (stats?.wins ?? 0).toString(), 13, TEXT.textLight);
      this.addText(this.statsContent, 505, y, (stats?.losses ?? 0).toString(), 13, TEXT.textLight);
      this.addText(
        this.statsContent,
        590,
        y,
        (stats?.abandoned ?? 0).toString(),
        13,
        TEXT.textLight,
      );
      this.addText(this.statsContent, 690, y, bests, 13, TEXT.textReward);
    });

    if (worldIds.length > VISIBLE_WORLDS) {
      const maxOffset = worldIds.length - VISIBLE_WORLDS;
      const showingEnd = Math.min(this.worldsScrollOffset + VISIBLE_WORLDS, worldIds.length);
      this.addText(
        this.statsContent,
        740,
        241,
        `${this.worldsScrollOffset + 1}–${showingEnd} of ${worldIds.length}`,
        11,
        TEXT.textMuted,
      );

      if (this.worldsScrollOffset > 0) {
        const upArrow = this.add
          .text(840, 287, "▲", textStyle({ fontSize: "16px", color: "#d6b15c" }))
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => {
            this.worldsScrollOffset -= 1;
            this.renderStats();
          });
        upArrow.on("pointerover", () => upArrow.setAlpha(0.7));
        upArrow.on("pointerout", () => upArrow.setAlpha(1));
        this.statsContent.add(upArrow);
      }

      if (this.worldsScrollOffset < maxOffset) {
        const downArrow = this.add
          .text(840, 412, "▼", textStyle({ fontSize: "16px", color: "#d6b15c" }))
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => {
            this.worldsScrollOffset += 1;
            this.renderStats();
          });
        downArrow.on("pointerover", () => downArrow.setAlpha(0.7));
        downArrow.on("pointerout", () => downArrow.setAlpha(1));
        this.statsContent.add(downArrow);
      }
    }

    const lastRun = lifetime.lastRun;
    if (lastRun !== undefined) {
      this.addPanel(this.statsContent, 44, 454, 812, 72);
      const display = worldDisplayManifest[lastRun.worldId];
      this.addText(this.statsContent, 64, 472, "Last Run", 18, "#d6b15c", true);
      this.addText(
        this.statsContent,
        64,
        502,
        [
          display?.name ?? lastRun.worldId,
          lastRun.outcome,
          formatDuration(lastRun.activeDurationMs),
          `${lastRun.turns} turns`,
          `${lastRun.cardsPlayed} cards`,
          `${lastRun.progressDealt} progress`,
          `${lastRun.damageTaken} damage`,
        ].join("   "),
        13,
        TEXT.textLight,
      );
    }
  }

  private renderFeats(): void {
    this.featsContent?.destroy(true);
    this.featsContent = this.add.container(0, 0);

    this.addPanel(this.featsContent, 44, 82, 812, 442);
    this.addText(this.featsContent, 64, 100, "Feats", 18, "#d6b15c", true);

    if (this.featsStore !== undefined) {
      const balance = computeFragmentBalance(this.featsStore.getProfile(), FEAT_CATALOG);
      this.addText(
        this.featsContent,
        500,
        103,
        `Total Memory Fragments: ${balance}`,
        14,
        TEXT.textReward,
        true,
      );

      const featsProfile = this.featsStore.getProfile();

      const FEAT_NAME_X = 64;
      const FEAT_DESC_X = 184;
      const FEAT_NAME_W = FEAT_DESC_X - FEAT_NAME_X - 8;
      const FEAT_REWARD_X = 684;
      const FEAT_DESC_W = FEAT_REWARD_X - FEAT_DESC_X - 8;
      const FEAT_EARNED_X = 764;

      this.addText(
        this.featsContent,
        FEAT_NAME_X,
        133,
        "Name",
        16,
        TEXT.textLight,
        true,
        undefined,
        FEAT_NAME_W,
      );
      this.addText(
        this.featsContent,
        FEAT_DESC_X,
        133,
        "Description",
        16,
        TEXT.textLight,
        true,
        undefined,
        FEAT_DESC_W,
      );
      this.addText(this.featsContent, FEAT_REWARD_X, 133, "Reward", 16, TEXT.textLight, true);
      this.addText(this.featsContent, FEAT_EARNED_X, 133, "Earned", 16, TEXT.textLight, true);

      FEAT_CATALOG.forEach((feat, index) => {
        if (this.featsContent === undefined) {
          console.error("Feats content is undefined when adding stats panel");
          return;
        }
        const y = 165 + index * 32;

        const reward = feat.reward.items
          .map((item) => {
            switch (item.type) {
              case "memoryFragments":
                return `+${item.amount}`;
              case "unlock":
                return `${item.id}`;
            }
          })
          .join(", ");

        const bEarned = featsProfile.earned.some((e) => e.featId == feat.id);
        const color = bEarned ? TEXT.textReward : TEXT.textLight;
        this.addText(this.featsContent, FEAT_NAME_X, y, feat.name, 13, color);
        this.addText(this.featsContent, FEAT_DESC_X, y, feat.description, 13, color);
        this.addText(this.featsContent, FEAT_REWARD_X, y, reward, 13, color);
        if (bEarned) {
          const at = featsProfile.earned
            .filter((e) => e.featId == feat.id)
            .map((e) => this.toDateStr(e.earnedAt));
          if (at.length > 0 && at[0]) {
            this.addText(this.featsContent, FEAT_EARNED_X, y, at[0], 13, color);
          }
        }
      });
    }
  }

  private toDateStr(epochMs: number): string {
    const date = new Date(epochMs);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  }

  private addPanel(
    content: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    strokeOverride?: number,
  ): void {
    const panel = this.add.rectangle(x, y, w, h, 0x15101d, 0.92).setOrigin(0, 0);
    panel.setStrokeStyle(1, strokeOverride ?? 0x5f4b2a, 0.85);
    panel.setRounded(8);
    content.add(panel);
  }

  private addText(
    content: Phaser.GameObjects.Container,
    x: number,
    y: number,
    value: string,
    size: number,
    color: string,
    bold = false,
    wordWrapOverride?: number,
    maxWidth?: number,
  ): Phaser.GameObjects.Text {
    const text = this.add.text(
      x,
      y,
      value,
      textStyle({
        fontSize: `${size}px`,
        color,
        fontStyle: bold ? "bold" : "",
        wordWrap: { width: wordWrapOverride ?? 780 },
      }),
    );
    if (maxWidth !== undefined) {
      if (text.width > maxWidth) {
        text.setScale(maxWidth / text.width);
      }
    }
    content.add(text);
    return text;
  }

  private exportStats(): void {
    if (this.statsTransfer === undefined) return;

    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([this.statsTransfer.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `shattered-worlds-stats-${date}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private chooseImportFile(): void {
    if (this.statsTransfer === undefined) return;

    this.fileInput?.remove();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file === undefined) return;
      void file.text().then((text) => this.inspectImport(text));
    });
    document.body.append(input);
    this.fileInput = input;
    input.click();
  }

  private inspectImport(text: string): void {
    const inspected = this.statsTransfer?.inspectImport(text);
    if (inspected === undefined) return;
    if (!inspected.ok) {
      this.messageText?.setText(inspected.reason);
      return;
    }
    this.showImportConfirm(inspected);
  }

  private showImportConfirm(inspected: Extract<InspectedStatsImport, { ok: true }>): void {
    this.confirmOverlay?.destroy(true);
    const overlay = this.add.container(CANVAS_W / 2, CANVAS_H / 2).setDepth(1000);
    const bg = this.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x050409, 0.82);
    bg.setInteractive();
    const panel = this.add.rectangle(0, 0, 560, 230, 0x15101d, 0.98);
    panel.setStrokeStyle(2, 0xd6b15c, 0.95);
    panel.setRounded(8);
    const text = this.add
      .text(
        0,
        -56,
        [
          "Overwrite current Chronicle data?",
          inspected.needsMigration ? "This older file will be upgraded during import." : "",
        ]
          .filter(Boolean)
          .join("\n"),
        textStyle({
          fontSize: "18px",
          color: TEXT.textLight,
          align: "center",
          wordWrap: { width: 480 },
        }),
      )
      .setOrigin(0.5, 0.5);
    overlay.add([bg, panel, text]);
    this.confirmOverlay = overlay;

    overlay.add([
      this.createOverlayButton(-82, 62, "Cancel", () => overlay.destroy(true)),
      this.createOverlayButton(82, 62, "Import", () => {
        this.statsTransfer?.applyImport(inspected);
        overlay.destroy(true);
        this.messageText?.setText("");
        this.worldsScrollOffset = 0;
        this.renderStats();
      }),
    ]);
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
}
