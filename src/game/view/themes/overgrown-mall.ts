import { VisualTheme } from './theme'

// Verdant-overgrowth identity: the mall is still a retail interior, so the
// keynote leans cyan-green to stay distinct from zombie-big-box's acid green.
export const OVERGROWN_MALL_THEME: VisualTheme = {
  worldId: 'overgrown-mall',
  intrusionHue: '#35e0a0',
  realityPalette: {
    title: '#9aa89c',
    text: '#6ecf9a',
    disabled: '#5f7065',
    confirm: '#8af0a4',
    cancel: '#e29266',
  },
  doorGlowTint: 0x35e0a0,
  doorTint: 0x56665c,
  frameStyle: {
    selectedBorder: 0xffd24a,
    targetBorder: 0x35e0a0,
    discardBorder: 0xff9a3d,
    connectorProgress: 0x35e0a0,
    connectorDestroy: 0xff4f5f,
    connectorReturn: 0x8a88ff,
    ringAccent: 0x35e0a0,
    targetGlow: 0x8affc7,
    committedTarget: 0x1f5c48,
  },
  backdrop: {
    realityKey: 'overgrown-mall-bg',
    intrusionKey: 'overgrown-mall-overlay',
  },
  worldCardfrontKey: 'overgrown-mall-cardfront',
}
