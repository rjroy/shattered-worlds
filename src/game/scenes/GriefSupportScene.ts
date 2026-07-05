import Phaser from "phaser";

import { addScreenBackdrop } from "../view/screenBackdrop";
import { textStyle, TEXT } from "../view/presentation";
import { CANVAS_W, CANVAS_H } from "../view/layout";
import { FONTS } from "../view/fonts";
import { openExternalLink } from "../view/externalLink";
import type { GriefSupportStore } from "../runtime/griefSupportProfile";

const LINK_STROKE = 0x88ccff;
type GriefSupportMode = "interstitial" | "standalone";

/**
 * One-time interstitial shown before Table on first entry to any of the
 * grief-arc finale worlds (questions/answers/the-beginning — REQ-W13-30..33).
 * Verbatim copy source: .lore/work/brainstorm/player-support-message.md.
 */
export class GriefSupportScene extends Phaser.Scene {
  private readonly griefSupportStore: GriefSupportStore | undefined;
  private worldId_: string | undefined = undefined;
  private seed_ = 0;
  private mode_: GriefSupportMode = "interstitial";
  private continueButtonBg: Phaser.GameObjects.Rectangle | undefined;

  constructor(griefSupportStore?: GriefSupportStore) {
    super({ key: "GriefSupport" });
    this.griefSupportStore = griefSupportStore;
  }

  // Phaser reuses the scene instance across launches, so per-entry state must
  // be reset here rather than relying on field initializers, which only run
  // once. Mirrors TableScene.init's fallback shape.
  init(data: { worldId?: string; seed?: number; mode?: GriefSupportMode }): void {
    this.worldId_ = data.worldId;
    this.seed_ = data.seed ?? Math.floor(Math.random() * 2 ** 32);
    this.mode_ = data.mode ?? "interstitial";
  }

  create(): void {
    addScreenBackdrop(this, {
      key: "screen-destiny",
      veilAlpha: 0.88,
      tint: 0x8ea9ff,
    });

    const centerX = CANVAS_W / 2;
    let y = 84;

    this.add
      .text(
        centerX,
        y,
        "Need support?",
        textStyle({
          fontFamily: FONTS.title,
          fontSize: "34px",
          color: TEXT.textLight,
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0);
    y += 68;

    this.add
      .text(
        centerX,
        y,
        "This story deals with grief, death, and losing a parent. If it brings up " +
          "something difficult, it's okay to pause. You don't have to face it alone.",
        textStyle({
          fontFamily: FONTS.body,
          fontSize: "16px",
          color: TEXT.textMuted,
          align: "center",
          wordWrap: { width: 620 },
          lineSpacing: 4,
        }),
      )
      .setOrigin(0.5, 0);
    y += 96;

    this.addLink(centerX, y, "Find free, confidential support in your country", () =>
      openExternalLink("https://findahelpline.com/"),
    ).setOrigin(0.5, 0);
    y += 46;

    this.addCrisisLine(centerX, y);
    y += 50;

    this.add
      .text(
        centerX,
        y,
        "If you are in immediate danger, contact your local emergency services.",
        textStyle({
          fontFamily: FONTS.body,
          fontSize: "14px",
          color: TEXT.textPenalty,
        }),
      )
      .setOrigin(0.5, 0);

    this.createContinueButton(centerX, CANVAS_H - 70);
  }

  /**
   * "In the U.S. or Canada, call or text 988 for immediate crisis support.
   * (U.S. · Canada)" with "988" emphasized and two inline clickable region
   * links inside the parenthetical. Built as separate text objects laid out
   * left-to-right and centered as a group, since Phaser text has no native
   * inline-link or inline-bold markup. Each segment carries its own gap (0
   * for segments that hug their neighbor, e.g. "(" before "U.S." and ")"
   * right after "Canada"; the default otherwise) to reproduce the source's
   * punctuation spacing exactly.
   */
  private addCrisisLine(centerX: number, y: number): void {
    const plain = (label: string) =>
      this.add.text(
        0,
        y,
        label,
        textStyle({ fontFamily: FONTS.body, fontSize: "15px", color: TEXT.textMuted }),
      );

    const defaultGap = 10;
    const segments: { part: Phaser.GameObjects.Text; gap: number }[] = [
      { part: plain("In the U.S. or Canada, call or text"), gap: 0 },
      {
        part: this.add.text(
          0,
          y,
          "988",
          textStyle({
            fontFamily: FONTS.body,
            fontSize: "15px",
            color: TEXT.textMuted,
            fontStyle: "bold",
          }),
        ),
        gap: defaultGap,
      },
      { part: plain("for immediate crisis support."), gap: defaultGap },
      { part: plain("("), gap: defaultGap },
      {
        part: this.addLink(0, y, "U.S.", () =>
          openExternalLink("https://988lifeline.org/get-help/"),
        ),
        gap: 0,
      },
      { part: plain("·"), gap: defaultGap },
      {
        part: this.addLink(0, y, "Canada", () => openExternalLink("https://988.ca/")),
        gap: defaultGap,
      },
      { part: plain(")"), gap: 0 },
    ];

    const totalWidth = segments.reduce((sum, { part, gap }) => sum + gap + part.width, 0);
    let x = centerX - totalWidth / 2;
    for (const { part, gap } of segments) {
      x += gap;
      part.setPosition(x, y);
      x += part.width;
    }
  }

  private addLink(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): Phaser.GameObjects.Text {
    const link = this.add.text(
      x,
      y,
      label,
      textStyle({
        fontFamily: FONTS.body,
        fontSize: "16px",
        color: TEXT.textKeyword,
        fontStyle: "bold",
      }),
    );
    link.setInteractive({ useHandCursor: true });
    link.on("pointerdown", onClick);
    return link;
  }

  private createContinueButton(x: number, y: number): void {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 168, 44, 0x15101d, 0.94);
    bg.setStrokeStyle(1, LINK_STROKE, 0.9);
    bg.setRounded(6);
    bg.setInteractive({ useHandCursor: true });
    const label = this.add
      .text(
        0,
        0,
        "Continue",
        textStyle({
          fontFamily: FONTS.ui,
          fontSize: "16px",
          color: TEXT.textLight,
          fontStyle: "bold",
        }),
      )
      .setOrigin(0.5, 0.5);
    container.add([bg, label]);
    this.continueButtonBg = bg;
    bg.on("pointerdown", () => this.onContinue());
  }

  private onContinue(): void {
    // Guard against a fast double-click double-enqueuing scene transitions.
    this.continueButtonBg?.disableInteractive();
    this.griefSupportStore?.update({ hasSeenGriefSupportNotice: true });
    if (this.mode_ === "interstitial" && this.worldId_ !== undefined) {
      // This scene's job is done after one acknowledgment; stop it rather than
      // leaving it stacked (and still interactive) underneath Table.
      this.scene.launch("Table", { worldId: this.worldId_, seed: this.seed_ });
    } else {
      this.scene.resume("WorldSelect");
    }
    this.scene.stop();
  }
}
