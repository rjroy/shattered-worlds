// Shared geometry for the Phaser renderer. Keep stable canvas, card, row, HUD,
// pile, and scene-selection measurements here so layout changes have one home.

export const CANVAS_W = 900;
export const CANVAS_H = 600;

export const CARD_FACE = {
  width: 150,
  height: 196,
  inset: {
    x: 0,
    y: 90,
    width: 120,
    height: 70,
  },
} as const;

// Token-row effect lines: the compiled icon+text card rules (effectLineView.ts).
export const EFFECT_ROW = {
  fontSize: 14, // main/branch text px (player face default); callers may override
  branchIndent: 10, // px shift right for Modal 'branch' lines
  hangIndent: 12, // px shift for lines hanging under a leading trigger icon
  tokenGap: 4, // px between adjacent tokens in a row
  lineSpacing: 2, // px between stacked rows
  iconOnlyHeightFactor: 1.4, // line height (in font-size units) when a line has no text to measure
  iconTextureSize: 32, // px of the generated placeholder icon textures
} as const;

export const TABLE_LAYOUT = {
  worldRowY: 140,
  handRowY: 420,
  cardSpacing: 156,
  rowCenterX: CANVAS_W / 2,
  rowWidthPadding: 25,
  cardDepth: 100,
  cardHoverDepth: 200,
  connectorDepth: 500,
  previewDepth: 575,
  modalDepth: 1000,
  // Action-confirmation modal sits above tooltips (2000) so the consequence
  // panel and its blocking backdrop are never occluded by a hover tooltip.
  confirmDepth: 2500,
  selectionHint: { x: CANVAS_W / 2, y: 580 },
  previewSlot: { x: CANVAS_W / 2, y: 565 },
  rowNav: {
    world: { previousX: 780, nextX: 820, buttonY: 265, labelX: 800, labelY: 295 },
    player: { previousX: 100, nextX: 140, buttonY: 295, labelX: 120, labelY: 265 },
    labelSafeSize: { width: 96, height: 28 },
    buttonSafeSize: { width: 40, height: 30 },
    hoverSafePadding: 16,
  },
  buttons: {
    exit: { x: 20, y: 22 },
    endTurn: { x: 830, y: 560 },
    cancel: { x: 830, y: 500 },
    confirm: { x: 830, y: 340 },
    settings: { x: 818, y: 22 },
    help: { x: 860, y: 22 },
  },
} as const;

export const HUD_LAYOUT = {
  panel: {
    x: 50,
    y: 0,
    width: 280,
    height: 45,
    sideInset: 20,
    edgeInset: 6,
  },
  labels: {
    hpX: 30,
    actX: 110,
    energyX: 230,
    powerUpX: 300,
  },
  energyIconSize: 28,
  energyIconOffsetX: 9,
  powerUps: {
    iconSize: 32,
    countGap: 4,
    itemGap: 12,
    panelPadX: 12,
  },
} as const;

export const PILE_LAYOUT = {
  cardWidth: 50,
  cardHeight: 64,
  cardOffset: 2,
  maxVisibleCards: 5,
  player: { x: 60, y: 440 },
  world: { x: 850, y: 180 },
  discard: { x: 60, y: 560 },
  labelY: 20,
} as const;

export const WORLD_SELECT_LAYOUT = {
  card: {
    blend: {
      color: 0x5f4580,
      scale: 100,
      weight: 20,
    },
    y: 390,
    width: 240,
    height: 350,
    wordWrap: 240 - 24,
    gap: 30,
    repeatScale: 0.8,
    delay: {
      first: 1000,
      repeat: 500,
    },
    strokeWidth: 2,
    name: {
      y: 30 - 350 / 2,
      fontSize: "17px",
    },
    tag: {
      y: 60 - 350 / 2,
      fontSize: "14px",
    },
    story: {
      y: 90 - 350 / 2,
      fontSize: "13px",
    },
    badge: {
      x: 240 / 2 - 48,
      y: 350 / 2 - 20,
      fontSize: "13px",
      rounded: 6,
    },
    cycle: {
      x: -10,
      y: 350 / 2 - 20,
      fontSize: "11px",
      rounded: 6,
    },
    pip: {
      x: 40 - 240 / 2,
      y: 350 / 2 - 20,
      fontSize: "14px",
      rounded: 6,
    },
    locked: {
      y: 350 / 2 - 68,
      fontSize: "13px",
      textColor: "#f2d68a",
      overlay: {
        color: 0x050409,
        alpha: 0.52,
      },
      stroke: {
        color: 0xf2d68a,
        alpha: 0.72,
      },
      alpha: 0.9,
      rounded: 5,
      scale: 1.05,
    },
    text: {
      bg: {
        color: 0x0b0710,
        alpha: 0.6,
        rounded: 4,
      },
      gap: 10,
      padding: 24,
    },
  },
  arrow: {
    y: 390,
    fontSize: "46px",
    width: 44,
    height: 72,
    gap: 32,
    bg: {
      alpha: 0.66,
      color: 0x160f1f,
    },
    stroke: {
      width: 2,
      color: 0xc178bc,
      alpha: 0.9,
    },
  },
  center: {
    x: CANVAS_W / 2,
    y: CANVAS_H / 2,
  },
  selection: {
    x: CANVAS_W / 2,
    y: CANVAS_H - 20,
  },
  buttons: {
    hoverScale: 1.08,
    bg: { color: 0x0f0b15, alpha: 0.82, rounded: 6 },
    stroke: { width: 1, color: 0xd6b15c, alpha: 0.9 },
    chronicle: { fontSize: "15px", x: CANVAS_W - 64, y: 34, width: 88, height: 34 },
    help: { fontSize: "20px", x: CANVAS_W - 130, y: 34, width: 34, height: 34 },
    destiny: { fontSize: "15px", x: CANVAS_W - 196, y: 34, width: 88, height: 34 },
    setting: { fontSize: "20px", x: CANVAS_W - 264, y: 34, width: 34, height: 34 },
    support: { fontSize: "15px", x: CANVAS_W - 348, y: 34, width: 100, height: 34 },
  },
  visibleWorldCount: 3,
  hoverScale: 1.15,
} as const;
