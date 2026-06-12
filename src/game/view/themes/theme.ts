export interface FrameStyle {
  selectedBorder: number
  targetBorder: number
  discardBorder: number
  connectorProgress: number  // accent line for a progress/deal action; pairs with ringAccent
  connectorDestroy: number   // red, for destroy actions
  connectorReturn: number    // cool/blue, for return-to-deck actions
  ringAccent: number         // cost-ring fill color (targetBorder green family)
  targetGlow: number         // hover-target emphasis tint/glow
  playableGlow: number         // hover-target emphasis tint/glow
  committedTarget: number    // muted "already locked here" mark
}

export interface VisualTheme {
  worldId: string
  intrusionHue: string
  realityPalette: {
    title: string
    text: string
    disabled: string
    confirm: string
    cancel: string
  }
  frameStyle: FrameStyle
  // optional tint for the door glow (Phaser hex int); if not set, glow is default color
  doorGlowTint?: number          
  // optional tint for the door (Phaser hex int); if not set, door is default color
  doorTint?: number              
  backdrop: {
    // Texture key for the reality backdrop
    realityKey: string
    // Texture key for the intrusion overlay
    intrusionKey: string
  }
  // theme-specific frame for world/hazard cards; falls back to 'cardfront'
  worldCardfrontKey?: string      
}
