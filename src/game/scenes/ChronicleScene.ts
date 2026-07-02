import Phaser from "phaser";

import { startMainTheme } from "../audio/menuMusic";
import type { UserSettingsStore } from "../runtime/userSettings";
import { worldManifest } from "../../data/worldManifest";
import { worldDisplayManifest } from "../../data/worldDisplayManifest";
import { FEAT_CATALOG, computeFragmentBalance } from "../../data/feats/catalog";
import type { RunStatsReader } from "../runtime/runStats";
import type { StatsTransfer, InspectedStatsImport } from "../runtime/statsTransfer";
import type { FeatsStore } from "../runtime/featsProfile";
import type { WitnessStore } from "../runtime/witnessProfile";
import { CANVAS_W, CANVAS_H } from "../view/layout";
import { FONTS } from "../view/fonts";
import { TEXT, textStyle } from "../view/presentation";
import { formatDuration } from "../view/format";
import { addScreenBackdrop } from "../view/screenBackdrop";
import type { FeatCondition, FeatReward } from "../../data/feats/types";

const VISIBLE_WORLDS = 4;
const VISIBLE_FEATS = 11;
const VISIBLE_RUN_CHECKS = 3;
const VISIBLE_RECORDS = 8;
const WORLDS_SCROLL_TOP = 222;
const WORLDS_SCROLL_BOTTOM = 432;
const FEATS_SCROLL_TOP = 165;
const FEATS_ROW_H = 32;
const RUN_CHECKS_SCROLL_TOP = 150;
const RUN_CHECKS_ROW_H = 24;
const RECORDS_SCROLL_TOP = 282;
const RECORDS_ROW_H = 24;
const TOUCH_SCROLL_THRESHOLD = 32;
const LIFETIME_ROW_H = 20;

type TouchScrollTarget = "worlds" | "feats" | "runChecks" | "records";

type Button = {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
};

type ThreatRecord = {
  threatId: string;
  target: number;
  featNames: string[];
};

type RunCheckRecord = {
  statId: string;
  label: string;
  value: string;
  targets: string;
};

export class ChronicleScene extends Phaser.Scene {
  private readonly runStats: RunStatsReader | undefined;
  private readonly statsTransfer: StatsTransfer | undefined;
  private readonly featsStore: FeatsStore | undefined;
  private readonly witnessStore: WitnessStore | undefined;
  private readonly userSettings: UserSettingsStore | undefined;
  private statsContent?: Phaser.GameObjects.Container;
  private featsContent?: Phaser.GameObjects.Container;
  private recordsContent?: Phaser.GameObjects.Container;
  private messageText?: Phaser.GameObjects.Text;
  private confirmOverlay?: Phaser.GameObjects.Container;
  private fileInput?: HTMLInputElement;
  private worldsScrollOffset = 0;
  private featsScrollOffset = 0;
  private runChecksScrollOffset = 0;
  private recordsScrollOffset = 0;
  private touchScrollTarget: TouchScrollTarget | undefined;
  private touchScrollLastY: number | undefined;
  private touchScrollRemainder = 0;

  constructor(
    runStats?: RunStatsReader,
    statsTransfer?: StatsTransfer,
    featsStore?: FeatsStore,
    witnessStore?: WitnessStore,
    userSettings?: UserSettingsStore,
  ) {
    super({ key: "Chronicle" });
    this.runStats = runStats;
    this.statsTransfer = statsTransfer;
    this.featsStore = featsStore;
    this.witnessStore = witnessStore;
    this.userSettings = userSettings;
  }

  create(): void {
    void startMainTheme(this, this.userSettings);
    this.worldsScrollOffset = 0;
    this.featsScrollOffset = 0;
    this.runChecksScrollOffset = 0;
    this.recordsScrollOffset = 0;
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
        fontFamily: FONTS.title,
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
          fontFamily: FONTS.body,
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
        if (this.statsContent !== undefined && this.statsContent.visible)
          this.scrollWorldsAt(pointer, deltaY);
        if (this.featsContent !== undefined && this.featsContent.visible)
          this.scrollFeatsAt(pointer, deltaY);
        if (this.recordsContent !== undefined && this.recordsContent.visible)
          this.scrollRecordsAt(pointer, deltaY);
      },
    );
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.beginTouchScroll(pointer));
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) =>
      this.updateTouchScroll(pointer),
    );
    this.input.on("pointerup", () => this.endTouchScroll());
    this.input.on("pointerupoutside", () => this.endTouchScroll());

    this.renderStats();
    this.renderFeats();
    this.renderRecords();

    this.switchTab(this.statsContent);

    this.createButton(280, 42, "Stats", () => this.switchTab(this.statsContent));
    this.createButton(380, 42, "Feats", () => this.switchTab(this.featsContent));
    this.createButton(480, 42, "Records", () => this.switchTab(this.recordsContent));
  }

  private switchTab(tabContent?: Phaser.GameObjects.Container): void {
    if (this.statsContent !== undefined) {
      this.statsContent.setVisible(this.statsContent == tabContent);
    }
    if (this.featsContent !== undefined) {
      this.featsContent.setVisible(this.featsContent == tabContent);
    }
    if (this.recordsContent !== undefined) {
      this.recordsContent.setVisible(this.recordsContent == tabContent);
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
          fontFamily: FONTS.ui,
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
              fontFamily: FONTS.title,
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
    const total_rows = [
      [
        `Runs ${lifetime.runs}`,
        `Wins ${lifetime.wins}`,
        `Losses ${lifetime.losses}`,
        `Abandons ${lifetime.abandoned}`,
        `Time ${formatDuration(lifetime.durationMs)}`,
      ],
      [
        `Turns ${lifetime.turns}`,
        `Cards ${lifetime.cardsPlayed}`,
        `Progress ${lifetime.progressDealt}`,
        `Damage ${lifetime.damageTaken}`,
      ],
      [
        `Hazards:`,
        `resolved: ${lifetime.hazardsResolved}`,
        `discarded: ${lifetime.hazardsDiscarded}`,
      ],
    ];
    total_rows.forEach((totals, index) => {
      if (!this.statsContent) return;
      const y = 132 + index * LIFETIME_ROW_H;
      this.addText(this.statsContent, 64, y, totals.join("   "), 13, TEXT.textLight);
    });

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
          .text(
            840,
            287,
            "▲",
            textStyle({ fontFamily: FONTS.monospace, fontSize: "16px", color: "#d6b15c" }),
          )
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => this.scrollWorldsBy(-1));
        upArrow.on("pointerover", () => upArrow.setAlpha(0.7));
        upArrow.on("pointerout", () => upArrow.setAlpha(1));
        this.statsContent.add(upArrow);
      }

      if (this.worldsScrollOffset < maxOffset) {
        const downArrow = this.add
          .text(
            840,
            412,
            "▼",
            textStyle({ fontFamily: FONTS.monospace, fontSize: "16px", color: "#d6b15c" }),
          )
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => this.scrollWorldsBy(1));
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
        250,
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
      const FEAT_REWARD_X = 664;
      const FEAT_DESC_W = FEAT_REWARD_X - FEAT_DESC_X - 8;
      const FEAT_EARNED_X = 744;

      this.addText(this.featsContent, FEAT_NAME_X, 133, "Name", 16, TEXT.textLight, true);
      this.addText(this.featsContent, FEAT_DESC_X, 133, "Description", 16, TEXT.textLight, true);
      this.addText(this.featsContent, FEAT_REWARD_X, 133, "Reward", 16, TEXT.textLight, true);
      this.addText(this.featsContent, FEAT_EARNED_X, 133, "Earned", 16, TEXT.textLight, true);

      const totalFragments = (r: FeatReward) =>
        r.items.reduce((acc, item) => acc + (item.type === "memoryFragments" ? item.amount : 0), 0);

      const compareCondition = (
        a: FeatCondition | undefined,
        b: FeatCondition | undefined,
      ): number => {
        if (a === undefined) return b === undefined ? 0 : -1;
        if (b === undefined) return +1;
        const statDelta = a.statId.localeCompare(b.statId);
        if (statDelta !== 0) return statDelta;
        if (a.value == b.value) return 0;
        switch (typeof a.value) {
          case "boolean":
            return a.value ? +1 : -1;
          case "string":
            if (typeof b.value !== "string") return -1;
            return a.value.localeCompare(b.value);
          case "number":
            if (typeof b.value !== "number") return -1;
            return a.value - b.value;
        }
      };

      const orderedFeats = [...FEAT_CATALOG];
      orderedFeats.sort((a, b) => {
        for (let i = 0; i < a.conditions.length; i++) {
          const conditionDelta = compareCondition(a.conditions[i], b.conditions[i]);
          if (conditionDelta !== 0) return conditionDelta;
        }
        const fragDelta = totalFragments(a.reward) - totalFragments(b.reward);
        if (fragDelta !== 0) return fragDelta;
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      });
      const visibleFeats = orderedFeats.slice(
        this.featsScrollOffset,
        this.featsScrollOffset + VISIBLE_FEATS,
      );

      visibleFeats.forEach((feat, index) => {
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
        this.addPanel(this.featsContent, 56, y - 1, 770, 32, 0x5e2f29);
        this.addText(this.featsContent, FEAT_NAME_X, y, feat.name, 13, color, false, FEAT_NAME_W);
        this.addText(
          this.featsContent,
          FEAT_DESC_X,
          y,
          feat.description,
          13,
          color,
          false,
          FEAT_DESC_W,
        );
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

    if (FEAT_CATALOG.length > VISIBLE_FEATS) {
      const maxOffset = FEAT_CATALOG.length - VISIBLE_FEATS;
      const showingEnd = Math.min(this.featsScrollOffset + VISIBLE_FEATS, FEAT_CATALOG.length);
      this.addText(
        this.featsContent,
        700,
        103,
        `${this.featsScrollOffset + 1}–${showingEnd} of ${FEAT_CATALOG.length}`,
        11,
        TEXT.textMuted,
      );

      if (this.featsScrollOffset > 0) {
        const upArrow = this.add
          .text(
            840,
            133,
            "▲",
            textStyle({ fontFamily: FONTS.monospace, fontSize: "16px", color: "#d6b15c" }),
          )
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => this.scrollFeatsBy(-1));
        upArrow.on("pointerover", () => upArrow.setAlpha(0.7));
        upArrow.on("pointerout", () => upArrow.setAlpha(1));
        this.featsContent.add(upArrow);
      }

      if (this.featsScrollOffset < maxOffset) {
        const downArrow = this.add
          .text(
            840,
            133 + 32 * VISIBLE_FEATS,
            "▼",
            textStyle({ fontFamily: FONTS.monospace, fontSize: "16px", color: "#d6b15c" }),
          )
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => this.scrollFeatsBy(1));
        downArrow.on("pointerover", () => downArrow.setAlpha(0.7));
        downArrow.on("pointerout", () => downArrow.setAlpha(1));
        this.featsContent.add(downArrow);
      }
    }
  }

  private renderRecords(): void {
    this.recordsContent?.destroy(true);
    this.recordsContent = this.add.container(0, 0);

    const lifetime = this.runStats?.lifetime();
    const witness = this.witnessStore?.getProfile();
    const lastRun = lifetime?.lastRun;
    const runChecks = this.runCheckRecords();

    this.addPanel(this.recordsContent, 44, 82, 812, 151);
    this.addText(this.recordsContent, 64, 100, "Last Run Checks", 18, "#d6b15c", true);

    if (lastRun === undefined) {
      this.addText(
        this.recordsContent,
        64,
        138,
        "Finish a run to see feat-related run stats.",
        14,
        TEXT.textMuted,
      );
    } else {
      this.addText(this.recordsContent, 64, 134, "Stat", 12, TEXT.textMuted, true);
      this.addText(this.recordsContent, 300, 134, "Last Run", 12, TEXT.textMuted, true);
      this.addText(this.recordsContent, 430, 134, "Feat Target", 12, TEXT.textMuted, true);

      const visibleRunChecks = runChecks.slice(
        this.runChecksScrollOffset,
        this.runChecksScrollOffset + VISIBLE_RUN_CHECKS,
      );

      visibleRunChecks.forEach((record, index) => {
        if (this.recordsContent === undefined) return;
        const y = 160 + index * RUN_CHECKS_ROW_H;
        this.addPanel(this.recordsContent, 56, y - 1, 770, RUN_CHECKS_ROW_H, 0x5e2f29);
        this.addText(this.recordsContent, 64, y, record.label, 13, TEXT.textLight, false, 210);
        this.addText(this.recordsContent, 300, y, record.value, 13, TEXT.textReward);
        this.addText(this.recordsContent, 430, y, record.targets, 13, TEXT.textLight);
      });

      if (runChecks.length > VISIBLE_RUN_CHECKS) {
        const maxOffset = runChecks.length - VISIBLE_RUN_CHECKS;
        const showingEnd = Math.min(
          this.runChecksScrollOffset + VISIBLE_RUN_CHECKS,
          runChecks.length,
        );
        this.addText(
          this.recordsContent,
          720,
          103,
          `${this.runChecksScrollOffset + 1}–${showingEnd} of ${runChecks.length}`,
          11,
          TEXT.textMuted,
        );

        if (this.runChecksScrollOffset > 0) {
          const upArrow = this.add
            .text(
              840,
              134,
              "▲",
              textStyle({ fontFamily: FONTS.monospace, fontSize: "16px", color: "#d6b15c" }),
            )
            .setInteractive({ useHandCursor: true })
            .on("pointerdown", () => this.scrollRunChecksBy(-1));
          upArrow.on("pointerover", () => upArrow.setAlpha(0.7));
          upArrow.on("pointerout", () => upArrow.setAlpha(1));
          this.recordsContent.add(upArrow);
        }

        if (this.runChecksScrollOffset < maxOffset) {
          const downArrow = this.add
            .text(
              840,
              208,
              "▼",
              textStyle({ fontFamily: FONTS.monospace, fontSize: "16px", color: "#d6b15c" }),
            )
            .setInteractive({ useHandCursor: true })
            .on("pointerdown", () => this.scrollRunChecksBy(1));
          downArrow.on("pointerover", () => downArrow.setAlpha(0.7));
          downArrow.on("pointerout", () => downArrow.setAlpha(1));
          this.recordsContent.add(downArrow);
        }
      }
    }

    this.addPanel(this.recordsContent, 44, 252, 812, 274);
    this.addText(this.recordsContent, 64, 270, "Threat Records", 18, "#d6b15c", true);
    this.addText(this.recordsContent, 64, 306, "Threat", 12, TEXT.textMuted, true);
    this.addText(this.recordsContent, 310, 306, "Resolved", 12, TEXT.textMuted, true);
    this.addText(this.recordsContent, 418, 306, "Seen", 12, TEXT.textMuted, true);
    this.addText(this.recordsContent, 500, 306, "Discarded", 12, TEXT.textMuted, true);
    this.addText(this.recordsContent, 608, 306, "Target", 12, TEXT.textMuted, true);
    this.addText(this.recordsContent, 704, 306, "Death", 12, TEXT.textMuted, true);

    const threatRecords = this.threatRecords();
    const visibleRecords = threatRecords.slice(
      this.recordsScrollOffset,
      this.recordsScrollOffset + VISIBLE_RECORDS,
    );

    visibleRecords.forEach((record, index) => {
      if (this.recordsContent === undefined) return;
      const y = 334 + index * RECORDS_ROW_H;
      const entry = witness?.threats[record.threatId];
      const resolved = entry?.resolvedCount ?? 0;
      const progress = `${resolved}/${record.target}`;
      const color = resolved >= record.target ? TEXT.textReward : TEXT.textLight;

      this.addPanel(this.recordsContent, 56, y - 1, 770, RECORDS_ROW_H, 0x5e2f29);
      this.addText(this.recordsContent, 64, y, record.threatId, 13, color, false, 230);
      this.addText(this.recordsContent, 310, y, resolved.toString(), 13, color);
      this.addText(
        this.recordsContent,
        418,
        y,
        (entry?.encounterCount ?? 0).toString(),
        13,
        TEXT.textLight,
      );
      this.addText(
        this.recordsContent,
        500,
        y,
        (entry?.discardedCount ?? 0).toString(),
        13,
        TEXT.textLight,
      );
      this.addText(this.recordsContent, 608, y, progress, 13, color);
      this.addText(
        this.recordsContent,
        704,
        y,
        entry?.diedTo ? "Yes" : "No",
        13,
        entry?.diedTo ? TEXT.textPenalty : TEXT.textMuted,
      );
    });

    if (threatRecords.length > VISIBLE_RECORDS) {
      const maxOffset = threatRecords.length - VISIBLE_RECORDS;
      const showingEnd = Math.min(this.recordsScrollOffset + VISIBLE_RECORDS, threatRecords.length);
      this.addText(
        this.recordsContent,
        720,
        273,
        `${this.recordsScrollOffset + 1}–${showingEnd} of ${threatRecords.length}`,
        11,
        TEXT.textMuted,
      );

      if (this.recordsScrollOffset > 0) {
        const upArrow = this.add
          .text(
            840,
            306,
            "▲",
            textStyle({ fontFamily: FONTS.monospace, fontSize: "16px", color: "#d6b15c" }),
          )
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => this.scrollRecordsBy(-1));
        upArrow.on("pointerover", () => upArrow.setAlpha(0.7));
        upArrow.on("pointerout", () => upArrow.setAlpha(1));
        this.recordsContent.add(upArrow);
      }

      if (this.recordsScrollOffset < maxOffset) {
        const downArrow = this.add
          .text(
            840,
            306 + RECORDS_ROW_H * VISIBLE_RECORDS,
            "▼",
            textStyle({ fontFamily: FONTS.monospace, fontSize: "16px", color: "#d6b15c" }),
          )
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => this.scrollRecordsBy(1));
        downArrow.on("pointerover", () => downArrow.setAlpha(0.7));
        downArrow.on("pointerout", () => downArrow.setAlpha(1));
        this.recordsContent.add(downArrow);
      }
    }
  }

  private runCheckRecords(): RunCheckRecord[] {
    const lastRun = this.runStats?.lifetime().lastRun;
    if (lastRun === undefined) return [];

    const statIds = [
      "finalHp",
      "healingReceived",
      "cardsThawed",
      "energy",
      "light",
      "brace",
      "heat",
    ];
    return statIds.map((statId) => ({
      statId,
      label: this.statLabel(statId),
      value: this.formatRunStatValue(statId, lastRun),
      targets: this.targetText(statId),
    }));
  }

  private threatRecords(): ThreatRecord[] {
    const byThreat = new Map<string, { target: number; featNames: Set<string> }>();

    for (const feat of FEAT_CATALOG) {
      for (const condition of feat.conditions) {
        const parsed = this.parseWitnessResolvedStat(condition);
        if (parsed === undefined) continue;

        const existing = byThreat.get(parsed.threatId);
        byThreat.set(parsed.threatId, {
          target: Math.max(existing?.target ?? 0, parsed.target),
          featNames: new Set([...(existing?.featNames ?? []), feat.name]),
        });
      }
    }

    return [...byThreat.entries()]
      .map(([threatId, record]) => ({
        threatId,
        target: record.target,
        featNames: [...record.featNames],
      }))
      .sort((a, b) => a.threatId.localeCompare(b.threatId));
  }

  private parseWitnessResolvedStat(
    condition: FeatCondition,
  ): { threatId: string; target: number } | undefined {
    if (!condition.statId.startsWith("witness.") || !condition.statId.endsWith(".resolvedCount")) {
      return undefined;
    }
    if (typeof condition.value !== "number") return undefined;

    return {
      threatId: condition.statId.slice("witness.".length, -".resolvedCount".length),
      target: condition.value,
    };
  }

  private statLabel(statId: string): string {
    switch (statId) {
      case "finalHp":
        return "Final HP";
      case "healingReceived":
        return "Healing Received";
      case "cardsThawed":
        return "Cards Thawed";
      case "energy":
        return "Energy";
      case "light":
        return "Light";
      case "brace":
        return "Brace";
      case "heat":
        return "Heat";
      default:
        return statId;
    }
  }

  private formatRunStatValue(
    statId: string,
    lastRun: NonNullable<ReturnType<RunStatsReader["lifetime"]>["lastRun"]>,
  ): string {
    switch (statId) {
      case "energy":
      case "light":
      case "brace":
      case "heat":
        return (lastRun.finalResources?.[statId] ?? 0).toString();
      default:
        return ((lastRun as unknown as Record<string, unknown>)[statId] ?? 0).toString();
    }
  }

  private targetText(statId: string): string {
    const targets = FEAT_CATALOG.flatMap((feat) =>
      feat.conditions
        .filter((condition) => condition.statId === statId)
        .map((condition) => this.conditionText(condition)),
    );
    return [...new Set(targets)].join(", ");
  }

  private conditionText(condition: FeatCondition): string {
    switch (condition.operator) {
      case "gte":
        return `>= ${condition.value}`;
      case "lte":
        return `<= ${condition.value}`;
      case "gt":
        return `> ${condition.value}`;
      case "lt":
        return `< ${condition.value}`;
      case "eq":
      case "is":
        return `${condition.value}`;
    }
  }

  private toDateStr(epochMs: number): string {
    const date = new Date(epochMs);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  }

  private scrollWorldsAt(pointer: Phaser.Input.Pointer, deltaY: number): void {
    if (!this.pointerInWorldsScrollArea(pointer)) return;
    this.scrollWorldsBy(deltaY > 0 ? 1 : -1);
  }

  private scrollFeatsAt(pointer: Phaser.Input.Pointer, deltaY: number): void {
    if (!this.pointerInFeatsScrollArea(pointer)) return;
    this.scrollFeatsBy(deltaY > 0 ? 1 : -1);
  }

  private scrollRecordsAt(pointer: Phaser.Input.Pointer, deltaY: number): void {
    if (this.pointerInRunChecksScrollArea(pointer)) {
      this.scrollRunChecksBy(deltaY > 0 ? 1 : -1);
      return;
    }
    if (!this.pointerInRecordsScrollArea(pointer)) return;
    this.scrollRecordsBy(deltaY > 0 ? 1 : -1);
  }

  private scrollWorldsBy(delta: number): void {
    const maxOffset = Math.max(0, Object.keys(worldManifest).length - VISIBLE_WORLDS);
    const next = Phaser.Math.Clamp(this.worldsScrollOffset + delta, 0, maxOffset);
    if (next === this.worldsScrollOffset) return;
    this.worldsScrollOffset = next;
    this.renderStats();
  }

  private scrollFeatsBy(delta: number): void {
    const maxOffset = Math.max(0, FEAT_CATALOG.length - VISIBLE_FEATS);
    const next = Phaser.Math.Clamp(this.featsScrollOffset + delta, 0, maxOffset);
    if (next === this.featsScrollOffset) return;
    this.featsScrollOffset = next;
    this.renderFeats();
  }

  private scrollRunChecksBy(delta: number): void {
    const maxOffset = Math.max(0, this.runCheckRecords().length - VISIBLE_RUN_CHECKS);
    const next = Phaser.Math.Clamp(this.runChecksScrollOffset + delta, 0, maxOffset);
    if (next === this.runChecksScrollOffset) return;
    this.runChecksScrollOffset = next;
    this.renderRecords();
  }

  private scrollRecordsBy(delta: number): void {
    const maxOffset = Math.max(0, this.threatRecords().length - VISIBLE_RECORDS);
    const next = Phaser.Math.Clamp(this.recordsScrollOffset + delta, 0, maxOffset);
    if (next === this.recordsScrollOffset) return;
    this.recordsScrollOffset = next;
    this.renderRecords();
  }

  private beginTouchScroll(pointer: Phaser.Input.Pointer): void {
    if (this.confirmOverlay !== undefined) return;

    const target = this.touchScrollTargetAt(pointer);
    if (target === undefined) return;

    this.touchScrollTarget = target;
    this.touchScrollLastY = pointer.y;
    this.touchScrollRemainder = 0;
  }

  private updateTouchScroll(pointer: Phaser.Input.Pointer): void {
    if (
      this.touchScrollTarget === undefined ||
      this.touchScrollLastY === undefined ||
      !pointer.isDown
    )
      return;

    this.touchScrollRemainder += this.touchScrollLastY - pointer.y;
    this.touchScrollLastY = pointer.y;

    const rows = Math.trunc(this.touchScrollRemainder / TOUCH_SCROLL_THRESHOLD);
    if (rows === 0) return;

    this.touchScrollRemainder -= rows * TOUCH_SCROLL_THRESHOLD;
    if (this.touchScrollTarget === "worlds") {
      this.scrollWorldsBy(rows);
    } else if (this.touchScrollTarget === "feats") {
      this.scrollFeatsBy(rows);
    } else if (this.touchScrollTarget === "runChecks") {
      this.scrollRunChecksBy(rows);
    } else {
      this.scrollRecordsBy(rows);
    }
  }

  private endTouchScroll(): void {
    this.touchScrollTarget = undefined;
    this.touchScrollLastY = undefined;
    this.touchScrollRemainder = 0;
  }

  private touchScrollTargetAt(pointer: Phaser.Input.Pointer): TouchScrollTarget | undefined {
    if (
      this.statsContent !== undefined &&
      this.statsContent.visible &&
      this.pointerInWorldsScrollArea(pointer)
    )
      return "worlds";
    if (
      this.featsContent !== undefined &&
      this.featsContent.visible &&
      this.pointerInFeatsScrollArea(pointer)
    )
      return "feats";
    if (
      this.recordsContent !== undefined &&
      this.recordsContent.visible &&
      this.pointerInRunChecksScrollArea(pointer)
    )
      return "runChecks";
    if (
      this.recordsContent !== undefined &&
      this.recordsContent.visible &&
      this.pointerInRecordsScrollArea(pointer)
    )
      return "records";
    return undefined;
  }

  private pointerInWorldsScrollArea(pointer: Phaser.Input.Pointer): boolean {
    return pointer.y >= WORLDS_SCROLL_TOP && pointer.y <= WORLDS_SCROLL_BOTTOM;
  }

  private pointerInFeatsScrollArea(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.y >= FEATS_SCROLL_TOP && pointer.y <= FEATS_SCROLL_TOP + FEATS_ROW_H * VISIBLE_FEATS
    );
  }

  private pointerInRunChecksScrollArea(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.y >= RUN_CHECKS_SCROLL_TOP &&
      pointer.y <= RUN_CHECKS_SCROLL_TOP + RUN_CHECKS_ROW_H * VISIBLE_RUN_CHECKS
    );
  }

  private pointerInRecordsScrollArea(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.y >= RECORDS_SCROLL_TOP &&
      pointer.y <= RECORDS_SCROLL_TOP + RECORDS_ROW_H * VISIBLE_RECORDS
    );
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

  private addIcon(
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
        fontFamily: FONTS.monospace,
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
        fontFamily: bold ? FONTS.body : FONTS.ui,
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
          fontFamily: FONTS.body,
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
        this.featsScrollOffset = 0;
        this.runChecksScrollOffset = 0;
        this.recordsScrollOffset = 0;
        this.renderStats();
        this.renderFeats();
        this.renderRecords();
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
          fontFamily: FONTS.ui,
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
