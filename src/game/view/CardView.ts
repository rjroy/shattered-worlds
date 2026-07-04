/**
 * CardView owns the Phaser objects for one card face, its selection highlight,
 * the world-card cost ring, and hover emphasis.
 *
 * The methods create or mutate Phaser game objects but never read or write
 * GameState. The scene passes data in; nothing here holds a reference to
 * GameCore. The exported functions at the bottom are compatibility wrappers
 * for older call sites and tests.
 */
import Phaser from "phaser";
import type { Card, CardEffect, Keyword, KeywordName, WorldCard } from "../../core/index";
import { concealOf, KEYWORD_COST_MODIFIERS, PERSISTENT_KEYWORDS } from "../../core/index";
import { CARD_FX_BASE, effectiveVolume } from "../audio/audioVolume";
import type { FrameStyle, VisualTheme } from "./themes/theme";
import { compileEffect, EffectLine, EffectToken, type IconId } from "../../core/view/effectGlyphs";
import { ENERGY_COST_TOOLTIP, PROGRESS_RING_TOOLTIP } from "../../core/view/effectTooltips";
import { addEffectLines } from "./effectLineView";
import { rarityStyle, rarityTierShift } from "./rarity";
import type { HighlightKind } from "../interaction/highlight";
import {
  TEXT,
  textStyle,
  selectCardFrontKey,
  highlightDescriptor,
  costRingArc,
  emphasisDescriptor,
} from "./presentation";
import { CARD_FACE, TABLE_LAYOUT } from "./layout";
import { addTooltip } from "./TooltipView";
import { FONTS } from "./fonts";

// ---------------------------------------------------------------------------
// Keyword display
// ---------------------------------------------------------------------------

/**
 * Render a structured keyword as text: name alone, or "name value" when the
 * keyword carries a value (e.g. "Concealed 3"). Keywords are text, never icons.
 */
export function formatKeyword(keyword: Keyword): string {
  return keyword.value === undefined || PERSISTENT_KEYWORDS.has(keyword.name)
    ? keyword.name
    : `${keyword.name} ${keyword.value}`;
}

/** Join a card's keywords into the on-face line ("Spore · Slow"). */
export function formatKeywords(keywords: readonly Keyword[]): string {
  return keywords.map(formatKeyword).join(" · ");
}

/** Join a card's applied keywords into the on-face line ("Alarm · Frozen") */
export function formatAppliedKeywords(card: Card): string | undefined {
  return card.appliedKeywords?.map(formatKeyword).join(" · ");
}

// ---------------------------------------------------------------------------
// Card dimensions
// ---------------------------------------------------------------------------

// Cards were sized to carry their full prose rules text on the face; the
// effect blocks now render as compact token rows (compileEffect +
// addEffectLines), but the dimensions are unchanged — the proportion pass is
// a deliberate follow-up (token-IR design §Risks). Six fit the 900px table.
const CARD_W = CARD_FACE.width;
const CARD_H = CARD_FACE.height;
const INSET_X = CARD_FACE.inset.x;
const INSET_Y = CARD_FACE.inset.y;
const INSET_W = CARD_FACE.inset.width;
const INSET_H = CARD_FACE.inset.height;

// ---------------------------------------------------------------------------
// Hover-target emphasis (S9) — the loudest read on the board
// ---------------------------------------------------------------------------

// Emphasis geometry. The glow is a rounded rectangle stroked OUTSIDE the card
// edge so it reads as a halo, not a border (the 3px target border lives on the
// list[1] rectangle and stays untouched). Lift + glow together make the hovered
// legal target unmistakable beyond a colour change.
const EMPHASIS_GLOW_PAD = 7; // px the glow ring extends past the card edge
const EMPHASIS_GLOW_LINE = 6; // glow stroke width
const EMPHASIS_GLOW_RADIUS = 10; // rounded-corner radius

function drawGlow(glow: Phaser.GameObjects.Graphics, color: number, alpha: number): void {
  glow.clear();
  const w = CARD_W + EMPHASIS_GLOW_PAD * 2;
  const h = CARD_H + EMPHASIS_GLOW_PAD * 2;
  glow.lineStyle(EMPHASIS_GLOW_LINE, color, alpha);
  glow.strokeRoundedRect(-w / 2, -h / 2, w, h, EMPHASIS_GLOW_RADIUS);
}

// ---------------------------------------------------------------------------
// Rarity stroke (REQ-RARITY-38, 39) — always-visible, intrinsic to the card
// ---------------------------------------------------------------------------

// A few px INSIDE the highlight rectangle's edge so the two strokes never
// overlap pixel-for-pixel: a selection/target stroke (highlightRect, list[1])
// can render at full strength on the card's outer edge while the rarity ring
// stays visible as a slightly inset second border. Both are real, distinct
// Phaser objects — neither overwrites the other's Graphics/Rectangle.
const RARITY_STROKE_INSET = 5;
// Exported so tests can distinguish the rarity stroke from any other
// rectangle on the scene (e.g. TooltipView's own background rectangle) by
// its stroke width, without duplicating the geometry constant.
export const RARITY_STROKE_WIDTH = 2;

// ---------------------------------------------------------------------------
// Card object factory
// ---------------------------------------------------------------------------

interface CardTextOpts {
  fontFamily?: string;
  fontSize: string;
  color: string;
  originY: number; // 0 = top-anchored, 1 = bottom-anchored
  bold?: boolean;
  maxWidth?: number;
  background?: number;
}

/** Add a horizontally-centered text line to a card container; returns it. */
function addCardText(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  str: string,
  opts: CardTextOpts,
): Phaser.GameObjects.Text[] {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: opts.fontFamily ?? FONTS.body,
    fontSize: opts.fontSize,
    color: opts.color,
  };
  if (opts.bold === true) style.fontStyle = "bold";
  const text = scene.add.text(x, y, "", textStyle(style));
  text.setOrigin(0.5, opts.originY);
  const wrapped = text.getWrappedText(str);
  container.add(text);
  let currY = y;
  return wrapped.map((line, i) => {
    const lineText = i == 0 ? text : scene.add.text(x, currY, "", textStyle(style));
    lineText.setText(line);
    lineText.setOrigin(0.5, opts.originY);
    if (opts.maxWidth !== undefined) {
      if (opts.maxWidth * 2 < lineText.width) {
        lineText.setWordWrapWidth(opts.maxWidth * 2);
        const scale = Math.min(0.5, opts.maxWidth / lineText.width);
        if (scale < 1.0) {
          lineText.setScale(scale);
        }
      } else {
        const scale = opts.maxWidth / lineText.width;
        if (scale < 1.0) {
          lineText.setScale(scale);
        }
      }
    }
    currY += lineText.height;
    if (opts.background !== undefined) {
      const bg = scene.add
        .rectangle(
          lineText.x,
          lineText.y,
          lineText.width + 6,
          lineText.height + 2,
          opts.background,
          0.5,
        )
        .setOrigin(0.5, opts.originY)
        .setRounded(4);
      container.add(bg);
      container.add(lineText);
      lineText.setAbove(bg);
    } else {
      container.add(lineText);
    }
    return lineText;
  });
}

/** Create a Phaser Container representing a single card (player or world). */
export class CardView extends Phaser.GameObjects.Container {
  readonly cardId: string;
  readonly activeModifiers: KeywordName[];
  readonly worldId: string;
  readonly visibleFxKey?: string;
  private loopedFx?: Phaser.Sound.BaseSound;

  private highlightRect: Phaser.GameObjects.Rectangle;
  private rarityRect: Phaser.GameObjects.Rectangle;
  private costRing?: CostRing;
  private costText?: Phaser.GameObjects.Text;
  private targetGlow?: Phaser.GameObjects.Graphics;
  private emphasized = false;
  private textContainer: Phaser.GameObjects.Container;

  // Concealment (world cards only). `concealDepth` is the card's Concealed:N
  // value (0 = never concealable). `revealObjects` is the identity face shown
  // when revealed; `shadowObjects` is the shadow overlay showing only its
  // depth chip. The two groups are toggled by `applyConcealment(light)` — a
  // purely cosmetic read of `state.light` that NEVER feeds back into core.
  // `concealedNow` tracks the last applied state so an unchanged light is
  // idempotent (no tween restart, no flicker) on the per-cycle reconcile path.
  private concealDepth = 0;
  private readonly revealObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly shadowObjects: Phaser.GameObjects.GameObject[] = [];
  private concealedNow: boolean | undefined = undefined;

  private pickBadge?: Phaser.GameObjects.Container;
  private pickedNow: boolean | undefined = undefined;

  /** Accessor that returns the current FX channel gain (0–1). */
  private readonly fxGain_: () => number;

  constructor(
    scene: Phaser.Scene,
    card: Card,
    activeModifiers: KeywordName[],
    x: number,
    y: number,
    theme: VisualTheme,
    resolveTheme: (worldId: string) => VisualTheme,
    fxGain: () => number = () => 1,
  ) {
    super(scene, x, y);
    this.fxGain_ = fxGain;
    this.activeModifiers = activeModifiers;
    scene.add.existing(this);
    this.cardId = card.id;
    this.worldId = theme.worldId;
    this.setDepth(TABLE_LAYOUT.cardDepth);

    if (card.fx) {
      for (const fx of card.fx) {
        if (fx.kind === "WhileVisible") {
          this.visibleFxKey = fx.key;
        }
      }
    }

    const isModifled = card.kind === "player" && card.modified;

    // Card frame image: world cards use the theme-specific front if available.
    const cardfrontKey = selectCardFrontKey(card, theme, resolveTheme);
    const cardImg = scene.add.image(0, 0, cardfrontKey);
    cardImg.setDisplaySize(CARD_W, CARD_H);
    this.add(cardImg);

    // Transparent overlay rectangle used only for selection highlight strokes.
    const bg = scene.add.rectangle(1, 1, CARD_W - 2, CARD_H - 2, 0x000000, 0);
    bg.setStrokeStyle(0);
    bg.setRounded(10);
    bg.setAlpha(0.4);
    this.highlightRect = bg;
    this.add(bg);

    // Rarity stroke: always-visible (rarity is intrinsic to the minted card,
    // not a selection state), so it is drawn once at construction from
    // card.rarity and never toggled. A distinct Rectangle, inset from
    // highlightRect's edge, so a simultaneous selection/target stroke on
    // highlightRect coexists without either clobbering the other.
    const rarityInset = RARITY_STROKE_INSET;
    const rarity = scene.add
      .rectangle(0, 0, CARD_W - rarityInset * 2, CARD_H - rarityInset * 2, 0x000000, 0)
      .setOrigin(0.5, 0.5);
    const style = rarityStyle(isModifled ? rarityTierShift(card.rarity, 1) : card.rarity);
    rarity.setStrokeStyle(RARITY_STROKE_WIDTH, style.color);
    rarity.postFX?.addGlow(style.color, style.glowStrength);
    rarity.setRounded(10);
    rarity.setAlpha(0.5);
    this.rarityRect = rarity;
    this.add(rarity);

    // Card inset image: if the template defines an insetKey, render the
    // corresponding image on top of the cardfront. Both player and world cards
    // can carry inset artwork (e.g. fog-beach-party world cards); cards without
    // an insetKey simply skip this block.
    if ("insetKey" in card && card.insetKey && card.insetKey !== "") {
      const insetImg = scene.add.image(INSET_X, INSET_Y, card.insetKey).setOrigin(0.5, 1);
      const ratio = Math.max(INSET_W / insetImg.width, INSET_H / insetImg.height);
      insetImg.setDisplaySize(insetImg.width * ratio, insetImg.height * ratio);
      this.add(insetImg);
      const frame = scene.add
        .nineslice(
          INSET_X,
          INSET_Y,
          "inset-frame",
          undefined,
          insetImg.width * ratio + 8,
          insetImg.height * ratio + 8,
          4,
          4,
          4,
          4,
        )
        .setOrigin(0.5, 1);
      this.add(frame);
    }

    const titleColor = isModifled ? TEXT.textReward : TEXT.textLight;

    // Name at top — identical for player and world cards.
    const nameText = addCardText(scene, this, 0, -CARD_H / 2 + 8, card.name, {
      fontFamily: FONTS.ui,
      fontSize: "16px",
      color: titleColor,
      bold: true,
      maxWidth: CARD_W - 48,
      originY: 0,
    });

    this.textContainer = scene.add.container(0, 0);
    this.add(this.textContainer);

    if (card.kind === "player") {
      // Keywords — same 9px line the world face uses, at the same offset, so a
      // Spore card is identifiable in hand (REQ-MALL-21).
      const hasKeywords = card.keywords.length > 0;
      if (hasKeywords) {
        addCardText(scene, this.textContainer, 0, -CARD_H / 2 + 23, formatKeywords(card.keywords), {
          fontFamily: FONTS.body,
          fontSize: "10px",
          color: TEXT.textKeyword,
          originY: 0,
        });
      }

      // Compact token rules (compileEffect + addEffectLines) — the whole face
      // is still self-explanatory: Modal and Sequence cards render every
      // branch / step as token rows. A keyword line pushes the block down to
      // the world face's effect offset so the two never collide; keywordless
      // cards keep the original layout. The block container's (0, 0) is its
      // top centre; both offsets are whole pixels (CARD_H is even).
      const effectBlock = addEffectLines(scene, compileEffect(card.effect, this.worldId), {
        maxWidth: CARD_W - 18,
        baseColor: TEXT.textLight,
        background: { color: 0x000000, alpha: 0.8 },
        warnLabel: card.name,
      });
      effectBlock.container.setPosition(0, -CARD_H / 2 + (hasKeywords ? 36 : 28));
      this.textContainer.add(effectBlock.container);

      // Energy cost badge: only for cards with energyCost > 0.
      if (card.energyCost > 0) {
        const badgeBg = scene.add.image(CARD_W / 2 - 16, -CARD_H / 2 + 16, "effect-icon-energy");
        badgeBg.setDisplaySize(28, 28);
        addTooltip(scene, badgeBg, ENERGY_COST_TOOLTIP);
        this.add(badgeBg);

        addCardText(scene, this, CARD_W / 2 - 16, -CARD_H / 2 + 16, String(card.energyCost), {
          fontFamily: FONTS.monospace,
          fontSize: "16px",
          color: TEXT.textEnergy,
          bold: true,
          originY: 0.5,
        });
      }

      // Exhaust badge: the flag lives on the card (not the effect), so it cannot
      // come through compileEffect.
      if (card.exhaust === true) {
        if (card.canDestroy) {
          addCardText(scene, this.textContainer, 0, CARD_H / 2 - 8, "Exhaust", {
            fontFamily: FONTS.body,
            fontSize: "10px",
            color: TEXT.textKeyword,
            bold: true,
            originY: 1,
            background: 0x000000,
          });
        } else {
          // If you cannot destroy normally, then exhaust is the only option
          addCardText(scene, this.textContainer, 0, CARD_H / 2 - 8, "Exhaust Only", {
            fontFamily: FONTS.body,
            fontSize: "9px",
            color: TEXT.textReward,
            bold: true,
            originY: 1,
            background: 0x000000,
          });
        }
      }

      if ((card.frozen ?? 0) > 0) {
        const ice = scene.add
          .rectangle(0, 0, CARD_W - 8, CARD_H - 8, 0xbfe9ff, 0.22)
          .setOrigin(0.5, 0.5)
          .setRounded(10);
        ice.setStrokeStyle(2, 0xe8f8ff, 0.85);
        this.add(ice);
        addCardText(scene, this, 0, CARD_H / 2 - 25, `Frozen ${card.frozen}`, {
          fontFamily: FONTS.body,
          fontSize: "12px",
          color: "#e8f8ff",
          bold: true,
          originY: 1,
          background: 0x102435,
        });
      }
    } else {
      const worldCard = card as WorldCard;

      // The world card's full identity face. Each piece is pushed onto
      // `revealObjects` so the shadow overlay can hide all of it at once when
      // the card is concealed; the name (built above) is part of that identity too.
      const reveal = this.revealObjects;
      for (const line of nameText) reveal.push(line);

      // Progress ring backing the cost digit.
      const costRing = scene.add.graphics() as CostRing;
      costRing.setPosition(CARD_W / 2 - 21, CARD_H / 2 - 21);
      this.costRing = costRing;
      this.add(costRing);
      reveal.push(costRing);

      // Cost label + value (cost is the Progress needed to clear the Hazard).
      for (const line of addCardText(
        scene,
        this,
        CARD_W / 2 - 21,
        CARD_H / 2 - 21,
        String(worldCard.cost),
        {
          fontFamily: FONTS.monospace,
          fontSize: "30px",
          color: TEXT.textCost,
          bold: true,
          originY: 0.5,
        },
      )) {
        this.costText = line;
        reveal.push(line);
      }
      for (const line of addCardText(scene, this, CARD_W / 2 - 21, CARD_H / 2 - 3, "to clear", {
        fontFamily: FONTS.body,
        fontSize: "8px",
        color: TEXT.textMuted,
        originY: 1,
      })) {
        reveal.push(line);
      }

      const costRingHit = scene.add.circle(CARD_W / 2 - 21, CARD_H / 2 - 21, 24, 0x000000, 0);
      addTooltip(scene, costRingHit, PROGRESS_RING_TOOLTIP);
      this.add(costRingHit);
      reveal.push(costRingHit);

      // Keywords. The whole keyword line is identity (hidden in shadow); the
      // Concealed:N depth chip is rendered separately on the shadow overlay below.
      if (worldCard.keywords.length > 0) {
        for (const line of addCardText(
          scene,
          this.textContainer,
          0,
          -CARD_H / 2 + 23,
          formatKeywords(worldCard.keywords),
          { fontFamily: FONTS.body, fontSize: "9px", color: TEXT.textKeyword, originY: 0 },
        )) {
          reveal.push(line);
        }
      }

      // onEndOfTurn, onDiscarded, onCleared, onPartialClear — compact token
      // blocks, each led by its trigger icon; text is tinted per block, while
      // the icon discs keep their own placeholder hues (effectLineLayout) until
      // real art lands (token-IR design §4). A `None` effect compiles to no
      // lines (height 0):
      // its empty container is dropped and contributes no spacing. currY stays
      // whole-pixel: it starts integral and `height` is contractually integral.
      const effectLineSpacing = 4;
      let currY = -CARD_H / 2 + 36;
      const triggerBlocks: {
        leadIcon: IconId;
        effect: CardEffect;
        color: string;
      }[] = [
        {
          leadIcon: "onClear",
          effect: worldCard.onCleared,
          color: TEXT.textReward,
        },
        {
          leadIcon: "onPartialClear",
          effect: worldCard.onPartialClear,
          color: TEXT.textPenalty,
        },
        {
          leadIcon: "onDiscard",
          effect: worldCard.onDiscarded,
          color: TEXT.textPenalty,
        },
        {
          leadIcon: "eachTurn",
          effect: worldCard.onEndOfTurn,
          color: TEXT.textHeld,
        },
        {
          leadIcon: "onDraw",
          effect: worldCard.onDraw,
          color: TEXT.textHeld,
        },
      ];
      for (const block of triggerBlocks) {
        const { container, height } = addEffectLines(
          scene,
          compileEffect(block.effect, this.worldId),
          {
            maxWidth: CARD_W - 18,
            baseColor: TEXT.textLight,
            fontSize: 12,
            leadIcon: block.leadIcon,
            background: { color: 0x000000, alpha: 0.8 },
            warnLabel: card.name,
          },
        );
        if (height === 0) {
          container.destroy();
          continue;
        }
        container.setPosition(0, currY);
        this.textContainer.add(container);
        reveal.push(container);
        currY += height + effectLineSpacing;
      }

      const modifierLines: EffectLine[] = activeModifiers.flatMap((name) => {
        const modifier = KEYWORD_COST_MODIFIERS[name];
        if (modifier === undefined) return [];

        const tokens: EffectToken[] = [];
        switch (modifier.kind) {
          case "ClearCostPerKeywordCount":
            tokens.push({
              kind: "text" as const,
              text: `+${modifier.costPer} / ${name}`,
            });
            return [{ tokens: tokens }];
          case "ClearCostPerOtherKeyword":
            tokens.push({
              kind: "text" as const,
              text: `+${modifier.costPer} / total ${name}`,
            });
            return [{ tokens: tokens }];
          case "ClearCostPerSelfKeyword":
            tokens.push({ kind: "text" as const, text: `+${modifier.costPer} / self ${name}` });
            return [{ tokens: tokens }];
        }
        return [];
      });

      const modifierBlock = addEffectLines(scene, modifierLines, {
        maxWidth: CARD_W - 18,
        baseColor: TEXT.textPenalty,
        fontSize: 12,
        background: { color: 0x000000, alpha: 0.8 },
        warnLabel: card.name,
        leadIcon: "progressCost",
      });
      if (modifierBlock.height === 0) {
        modifierBlock.container.destroy();
      } else {
        modifierBlock.container.setPosition(0, currY);
        this.textContainer.add(modifierBlock.container);
        reveal.push(modifierBlock.container);
        currY += modifierBlock.height + effectLineSpacing;
      }

      // Discard indicator.
      if (worldCard.discardable) {
        const discardY = Math.min(currY, CARD_H / 2 - 22);
        for (const line of addCardText(scene, this.textContainer, 0, discardY, "click to discard", {
          fontFamily: FONTS.body,
          fontSize: "9px",
          color: TEXT.textDiscard,
          bold: true,
          originY: 0,
          background: 0x000000,
        })) {
          reveal.push(line);
        }
      }

      // Shadow overlay. A world card with `Concealed:N` hides its identity
      // in shadow until Light reaches N; only the depth chip stays visible so
      // the player knows how much Light the card demands. Built unconditionally
      // (depth 0 means it never shows) and toggled by `applyConcealment(light)`,
      // a cosmetic read of `state.light` that never touches core. `buildShadowOverlay`
      // assigns `this.concealDepth` and populates `this.shadowObjects`.
      this.concealDepth = concealOf(worldCard);
      this.buildShadowOverlay(scene);
      // Start revealed; the first reconcile cycle calls applyConcealment(light)
      // with the live Light, so a card concealed at spawn snaps to shadow with no
      // flicker (the table draws once, synchronously, right after creation).
      this.setObjectsVisible(this.shadowObjects, false);
    }

    const appliedKeywordLabel = formatAppliedKeywords(card);
    if (appliedKeywordLabel !== undefined) {
      addCardText(scene, this.textContainer, 0, CARD_H / 2 - 35, appliedKeywordLabel, {
        fontFamily: FONTS.body,
        fontSize: "10px",
        color: "#fff2b8",
        bold: true,
        originY: 0.5,
        background: 0x352045,
      });
    }

    this.playWhileVisible();
  }

  public getCardId(): string {
    return this.cardId;
  }

  /**
   * Build the shadow overlay: a translucent shadow panel over the card face plus
   * the `Concealed:N` depth chip. Cosmetic only — it reads no GameState and feeds
   * nothing back into core. Hidden by default; `applyConcealment` reveals it.
   */
  private buildShadowOverlay(scene: Phaser.Scene): void {
    if (this.concealDepth <= 0) return;

    // Translucent panel that veils the identity face beneath it.
    const shadow = scene.add
      .rectangle(0, 0, CARD_W - 8, CARD_H - 8, 0x2a3a4a, 0.92)
      .setOrigin(0.5, 0.5)
      .setRounded(10);
    this.add(shadow);
    this.shadowObjects.push(shadow);

    // Depth chip: the only thing legible through the shadow. Reuses the
    // structured keyword formatter so "Concealed 3" matches the on-face
    // keyword language.
    for (const line of addCardText(
      scene,
      this,
      0,
      0,
      formatKeyword({ name: "Concealed", value: this.concealDepth }),
      {
        fontFamily: FONTS.body,
        fontSize: "15px",
        color: TEXT.textKeyword,
        bold: true,
        originY: 0.5,
      },
    )) {
      this.shadowObjects.push(line);
    }
  }

  /**
   * Toggle the shadow overlay against the current Light. Pure cosmetic
   * reconcile: called every drawAll cycle (and so on every LightChanged, since
   * EndTurn decay and GainLight both repaint), it reads `light` and shows the
   * shadow overlay when `isConcealed`, the identity face otherwise. Idempotent
   * on an unchanged concealment state. No-op for cards that can never be
   * concealed (depth 0).
   */
  applyConcealment(light: number): void {
    if (this.concealDepth <= 0) return;
    // isConcealed is `concealOf(card) > light`; with depth cached, the card is
    // concealed exactly while Light has not yet reached its depth.
    const concealed = this.concealDepth > light;
    if (this.concealedNow === concealed) return;
    this.concealedNow = concealed;
    this.setObjectsVisible(this.revealObjects, !concealed);
    this.setObjectsVisible(this.shadowObjects, concealed);
  }

  private setObjectsVisible(
    objects: readonly Phaser.GameObjects.GameObject[],
    visible: boolean,
  ): void {
    for (const obj of objects) {
      (obj as unknown as { setVisible(v: boolean): void }).setVisible(visible);
    }
  }

  /** Apply a coloured stroke to communicate this card's selection state. */
  applyHighlight(kind: HighlightKind, frameStyle: FrameStyle): void {
    const { strokeWidth, strokeColor, fillColor, fillAlpha } = highlightDescriptor(
      kind,
      frameStyle,
    );
    this.highlightRect.setFillStyle(fillColor, fillAlpha);
    this.highlightRect.setStrokeStyle(strokeWidth, strokeColor);

    const picked = kind === "picked";
    if (this.pickedNow !== picked) {
      this.pickedNow = picked;
      this.obtainPickBadge(frameStyle.pickedBorder).setVisible(picked);
    }
  }

  /** Dim a card that is not currently playable. */
  setDimmed(dim: boolean): void {
    this.setAlpha(dim ? TEXT.dimAlpha : 1.0);
  }

  /** Animate a world card's progress ring toward `fraction` of a full circle. */
  updateCostRing(fraction: number, ringAccent: number): void {
    if (this.costRing === undefined) return;
    updateRingObject(this.scene, this.costRing, fraction, ringAccent);
  }

  /** Reconcile a world card's live effective clear cost and modifier colour. */
  updateCostLabel(cost: number, baseCost: number): void {
    if (this.costText === undefined) return;
    this.costText.setText(String(cost));
    const color =
      cost > baseCost ? TEXT.textPenalty : cost < baseCost ? TEXT.textReward : TEXT.textCost;
    this.costText.setColor(color);
  }

  setTextVisible(bVisible: boolean): void {
    this.textContainer.setVisible(bVisible);
  }

  /** Make this hovered legal target the loudest card on the board. */
  emphasize(glowColor: number, intensity: number): void {
    if (this.emphasized) return;

    const { scale, glowAlpha } = emphasisDescriptor(intensity);
    this.setScale(scale);
    const glow = this.obtainGlow();
    glow.setVisible(true);
    drawGlow(glow, glowColor, glowAlpha);
    this.emphasized = true;
    this.setDepth(TABLE_LAYOUT.cardHoverDepth);
  }

  /** Restore base transform: scale 1, glow hidden/cleared, emphasis off. */
  clearEmphasis(): void {
    this.setScale(1);
    if (this.targetGlow !== undefined) {
      this.targetGlow.clear();
      this.targetGlow.setVisible(false);
    }
    this.emphasized = false;
    this.setDepth(TABLE_LAYOUT.cardDepth);
  }

  /** Re-assert this card's base position. */
  setCardPosition(x: number, y: number): void {
    this.setPosition(x, y);
  }

  private playWhileVisible(): void {
    if (!this.visibleFxKey) return;

    const gain = this.fxGain_();
    this.loopedFx = this.scene.sound.add(this.visibleFxKey, {
      volume: effectiveVolume(CARD_FX_BASE, gain),
      loop: true,
    });
    this.loopedFx.play();
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.loopedFx) {
        this.loopedFx.stop();
      }
    });
  }

  private obtainGlow(): Phaser.GameObjects.Graphics {
    if (this.targetGlow !== undefined) return this.targetGlow;
    const glow = this.scene.add.graphics();
    this.add(glow);
    this.targetGlow = glow;
    return glow;
  }

  private obtainPickBadge(color: number): Phaser.GameObjects.Container {
    if (this.pickBadge !== undefined) return this.pickBadge;
    const badge = this.scene.add.container(-CARD_W / 2 + 16, CARD_H / 2 - 16);
    const circle = this.scene.add.graphics();
    circle.fillStyle(color, 1);
    circle.fillCircle(0, 0, 8);
    circle.setAlpha(0.8);
    badge.add(circle);
    const check = this.scene.add.text(
      0,
      0,
      "✓",
      textStyle({ fontFamily: FONTS.monospace, fontSize: "12px", color: "#ffffff" }),
    );
    check.setOrigin(0.5, 0.5);
    badge.add(check);
    badge.setVisible(false);
    this.add(badge);
    this.pickBadge = badge;
    return badge;
  }
}

/** Create a Phaser Container representing a single card (player or world). */
export function createCardObject(
  scene: Phaser.Scene,
  card: Card,
  activeModifiers: KeywordName[],
  x: number,
  y: number,
  theme: VisualTheme,
  resolveTheme: (worldId: string) => VisualTheme,
  fxGain?: () => number,
): Phaser.GameObjects.Container {
  return new CardView(scene, card, activeModifiers, x, y, theme, resolveTheme, fxGain);
}

// ---------------------------------------------------------------------------
// Highlight — called by TableScene after drawAll
// ---------------------------------------------------------------------------

/**
 * Apply a coloured stroke to a card container to communicate its state. The
 * "decide what it looks like" half lives in `highlightDescriptor`; this wrapper
 * only pushes that descriptor onto the list[1] overlay rectangle.
 */
export function applyCardHighlight(
  container: Phaser.GameObjects.Container,
  kind: HighlightKind,
  frameStyle: FrameStyle,
): void {
  if (container instanceof CardView) {
    container.applyHighlight(kind, frameStyle);
    return;
  }

  // The highlight rectangle is list[1] (list[0] is the cardfront image)
  const bg = container.list[1] as Phaser.GameObjects.Rectangle | undefined;
  if (bg === undefined) return;
  const { strokeWidth, strokeColor, fillColor, fillAlpha } = highlightDescriptor(kind, frameStyle);
  bg.setFillStyle(fillColor, fillAlpha);
  bg.setStrokeStyle(strokeWidth, strokeColor);
}

// ---------------------------------------------------------------------------
// Cost ring (S5) — world-card progress arc
// ---------------------------------------------------------------------------

// Ring geometry — shared by the snap path and the tween onUpdate so a tweened
// frame is drawn byte-for-byte the same as a snapped one.
const RING_RADIUS = 18;
const RING_LINE_WIDTH = 3;

// Fill/drain share one duration and easing so banking and the end-of-turn
// reset read as a single clock moving in opposite directions (FEEDBACK-8).
const RING_TWEEN_DURATION = 300;
const RING_TWEEN_EASE = "Sine.easeInOut";

// Below this delta, target and displayed fraction are treated as equal: the
// call is a no-op (no tween restart, no jitter) so calling updateCostRing every
// reconcile cycle with the same target is idempotent.
const RING_FRACTION_EPSILON = 0.001;

// The ring Graphics also carries the fraction it is currently DISPLAYING (the
// tweened value, not the target). Stored on the object so it survives across
// reconcile cycles and a fresh tween can interpolate from wherever the last one
// left off (banking up, then draining back to 0, are the same clock).
type CostRing = Phaser.GameObjects.Graphics & { displayedFraction?: number };

/** Draw the ring arc for an exact fraction. Pure given (ring, fraction). */
function drawCostRing(
  ring: Phaser.GameObjects.Graphics,
  fraction: number,
  ringAccent: number,
): void {
  ring.clear();

  // Faint full-circle track so the ring reads even at low progress.
  ring.lineStyle(RING_LINE_WIDTH, ringAccent, 0.18);
  ring.strokeCircle(0, 0, RING_RADIUS);
  ring.fillStyle(ringAccent, 0.08);
  ring.fillCircle(0, 0, RING_RADIUS - RING_LINE_WIDTH / 2);

  // Angle math (clamp + clockwise sweep from the top) lives in costRingArc.
  const { clamped, start, end } = costRingArc(fraction);
  if (clamped <= 0) return;

  ring.lineStyle(RING_LINE_WIDTH, ringAccent, 1);
  ring.beginPath();
  ring.arc(0, 0, RING_RADIUS, start, end, false);
  ring.strokePath();
}

/**
 * Animate a world card's progress ring toward `fraction` of a full circle.
 *
 * The arc sweeps `fraction * 2π` clockwise from the top (12 o'clock), so the
 * fill grows by ANGLE, not by element count — the geometry is identical at cost
 * 1 and cost 10 (the boss). No-op for any container without a `costRing`
 * (player cards), which never get one.
 *
 * Banking progress (target rises) and the end-of-turn reset (target 0) are the
 * SAME tween in opposite directions, because the ring persists across reconcile
 * cycles (S3). The ring's currently displayed fraction is stored on the ring
 * object; each call interpolates from there to the new target.
 *
 * First render for a ring (no prior displayed value) snaps with no animation.
 * A target equal (within epsilon) to the displayed fraction is a no-op, so
 * calling this every cycle with an unchanged target never restarts the tween.
 *
 * Killability (ties to the S3 destruction pass): the tween targets the RING
 * GRAPHICS OBJECT itself, which is a child in `container.list`. The reconcile's
 * `killTweensOf(container.list)` (and `killTweensOf(container)`) therefore finds
 * and kills any in-flight ring tween BEFORE `container.destroy()`. Nothing here
 * tweens a detached proxy object that the destruction pass couldn't reach, so
 * onUpdate can never fire on a destroyed Graphics. No Tween reference is
 * retained across cycles (no `updateTo` on a recycled tween): each change does
 * `killTweensOf(ring)` then `scene.tweens.add`.
 */
export function updateCostRing(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  fraction: number,
  ringAccent: number,
): void {
  if (container instanceof CardView) {
    container.updateCostRing(fraction, ringAccent);
    return;
  }

  const ring = (container as Phaser.GameObjects.Container & { costRing?: CostRing }).costRing;
  if (ring === undefined) return;
  updateRingObject(scene, ring, fraction, ringAccent);
}

function updateRingObject(
  scene: Phaser.Scene,
  ring: CostRing,
  fraction: number,
  ringAccent: number,
): void {
  const target = Math.min(1, Math.max(0, fraction));
  const displayed = ring.displayedFraction;

  // First render for this ring: snap, record, no animation.
  if (displayed === undefined) {
    ring.displayedFraction = target;
    drawCostRing(ring, target, ringAccent);
    return;
  }

  // Idempotent: unchanged target must not restart the tween or jitter.
  if (Math.abs(target - displayed) < RING_FRACTION_EPSILON) return;

  // Kill any in-flight ring tween before starting a new one. Targeting the ring
  // object (not a retained Tween, not a free proxy) keeps the S3 destruction
  // pass able to cancel this tween, and lets the new tween start from wherever
  // the last one left off.
  scene.tweens.killTweensOf(ring);
  scene.tweens.add({
    targets: ring,
    displayedFraction: target,
    duration: RING_TWEEN_DURATION,
    ease: RING_TWEEN_EASE,
    onUpdate: () => {
      drawCostRing(ring, ring.displayedFraction ?? target, ringAccent);
    },
    onComplete: () => {
      // Settle exactly on target so float drift never leaves a partial arc.
      ring.displayedFraction = target;
      drawCostRing(ring, target, ringAccent);
    },
  });
}
