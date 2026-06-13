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
  modalDepth: 1000,
  selectionHint: { x: CANVAS_W / 2, y: 578 },
  previewSlot: { x: CANVAS_W / 2, y: 550 },
  buttons: {
    exit: { x: 20, y: 22 },
    endTurn: { x: 820, y: 560 },
    cancel: { x: 740, y: 570 },
    confirm: { x: 740, y: 540 },
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
  player: { x: 80, y: 440 },
  world: { x: 820, y: 440 },
  discard: { x: 80, y: 560 },
  labelY: 20,
} as const;

export const WORLD_SELECT_LAYOUT = {
  cardWidth: 240,
  cardHeight: 350,
  cardGap: 30,
  cardY: 390,
  visibleWorldCount: 3,
  arrowWidth: 44,
  arrowHeight: 72,
  arrowGap: 32,
  subtitleY: CANVAS_H - 20,
  hoverScale: 1.15,
  nameY: 30,
  tagMinY: 60,
  storyMinY: 90,
  textGap: 10,
  textPadding: 24,
} as const;
