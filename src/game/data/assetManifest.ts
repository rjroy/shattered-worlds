/// <reference types="vite/client" />
import cardbackUrl from "../assets/cardback.webp";
import cardfrontUrl from "../assets/cardfront.webp";
import walkerUrl from "../assets/walker.webp";
import doorUrl from "../assets/door.webp";
import doorGlowUrl from "../assets/door-glow.webp";
import textBackUrl from "../assets/text-background.webp";
import insetFrameUrl from "../assets/inset-frame.webp";
import effectIconEnergyUrl from "../assets/effect-icons/effect-icon-energy.png";
import effectIconBraceUrl from "../assets/effect-icons/effect-icon-brace.png";
import effectIconProgressUrl from "../assets/effect-icons/effect-icon-progress.png";
import effectIconProgressAllUrl from "../assets/effect-icons/effect-icon-progress-all.png";
import effectIconDrawUrl from "../assets/effect-icons/effect-icon-draw.png";
import effectIconWorldDrawUrl from "../assets/effect-icons/effect-icon-world-draw.png";
import effectIconHpUrl from "../assets/effect-icons/effect-icon-hp.png";
import effectIconLightUrl from "../assets/effect-icons/effect-icon-light.png";
import effectIconHeatUrl from "../assets/effect-icons/effect-icon-heat.png";
import effectIconDiscardUrl from "../assets/effect-icons/effect-icon-discard.png";
import effectIconDestroyUrl from "../assets/effect-icons/effect-icon-destroy.png";
import effectIconExileUrl from "../assets/effect-icons/effect-icon-exile.png";
import effectIconReturnUrl from "../assets/effect-icons/effect-icon-return.png";
import effectIconAddCardUrl from "../assets/effect-icons/effect-icon-add-card.png";
import effectIconSurviveUrl from "../assets/effect-icons/effect-icon-survive.png";
import effectIconVanishUrl from "../assets/effect-icons/effect-icon-vanish.png";
import effectIconEachTurnUrl from "../assets/effect-icons/effect-icon-each-turn.png";
import effectIconOnClearUrl from "../assets/effect-icons/effect-icon-on-clear.png";
import effectIconOnPartialClearUrl from "../assets/effect-icons/effect-icon-on-partial-clear.png";
import insetSprintUrl from "../assets/insets/inset-sprint.webp";
import insetExploreUrl from "../assets/insets/inset-explore.webp";
import insetBarricadeUrl from "../assets/insets/inset-barricade.webp";
import insetMedKitUrl from "../assets/insets/inset-medkit.webp";
import insetPanicUrl from "../assets/insets/inset-panic.webp";
import insetAdrenalineUrl from "../assets/insets/inset-adrenaline.webp";
import insetDoorUrl from "../assets/insets/inset-door.webp";
import insetWalkerUrl from "../assets/insets/inset-walker.webp";
import unlockActRewardUrl from "../assets/unlocks/act-reward.webp";
import unlockExtraBraceUrl from "../assets/unlocks/extra-brace.webp";
import unlockExtraEnergyUrl from "../assets/unlocks/extra-energy.webp";
import unlockExtraHpUrl from "../assets/unlocks/extra-hp.webp";
import unlockExtraLightUrl from "../assets/unlocks/extra-light.webp";
import unlockHandSizePerActUrl from "../assets/unlocks/hand-size-per-act.webp";
import unlockKeywordBonusUrl from "../assets/unlocks/keyword-bonus.webp";
import unlockMinEnergyUrl from "../assets/unlocks/min-energy.webp";
import unlockMinLightUrl from "../assets/unlocks/min-light.webp";
import unlockStarterFootballerUrl from "../assets/unlocks/starter-footballer.webp";
import worldSelectBgUrl from "../assets/world-select.webp";
import screenChronicleUrl from "../assets/screens/shattered-chronicle.webp";
import screenDestinyUrl from "../assets/screens/shattered-destiny.webp";
import screenLoseUrl from "../assets/screens/shattered-lose.webp";
import { worldAssetUrls } from "../worlds/assetBindings";

export const assetManifest: Record<string, string> = {
  cardback: cardbackUrl,
  cardfront: cardfrontUrl,
  walker: walkerUrl,
  door: doorUrl,
  "door-glow": doorGlowUrl,
  "text-back": textBackUrl,
  "inset-frame": insetFrameUrl,
  "effect-icon-energy": effectIconEnergyUrl,
  "effect-icon-brace": effectIconBraceUrl,
  "effect-icon-progress": effectIconProgressUrl,
  "effect-icon-progress-all": effectIconProgressAllUrl,
  "effect-icon-draw": effectIconDrawUrl,
  "effect-icon-world-draw": effectIconWorldDrawUrl,
  "effect-icon-hp": effectIconHpUrl,
  // Placeholder art until the Fog theme pass. The `light` IconId and the HUD
  // Light indicator both bind this key; a loaded texture takes precedence over
  // the generated disc placeholder behind the same key (see ensureEffectIconTextures).
  "effect-icon-light": effectIconLightUrl,
  "effect-icon-heat": effectIconHeatUrl,
  "effect-icon-discard": effectIconDiscardUrl,
  "effect-icon-destroy": effectIconDestroyUrl,
  "effect-icon-exile": effectIconExileUrl,
  "effect-icon-return": effectIconReturnUrl,
  "effect-icon-add-card": effectIconAddCardUrl,
  "effect-icon-survive": effectIconSurviveUrl,
  "effect-icon-vanish": effectIconVanishUrl,
  "effect-icon-each-turn": effectIconEachTurnUrl,
  "effect-icon-on-clear": effectIconOnClearUrl,
  "effect-icon-on-partial-clear": effectIconOnPartialClearUrl,
  "inset-sprint": insetSprintUrl,
  "inset-explore": insetExploreUrl,
  "inset-barricade": insetBarricadeUrl,
  "inset-medkit": insetMedKitUrl,
  "inset-panic": insetPanicUrl,
  "inset-adrenaline": insetAdrenalineUrl,
  "inset-door": insetDoorUrl,
  "inset-walker": insetWalkerUrl,
  "unlock/act-reward": unlockActRewardUrl,
  "unlock/extra-brace": unlockExtraBraceUrl,
  "unlock/extra-energy": unlockExtraEnergyUrl,
  "unlock/extra-hp": unlockExtraHpUrl,
  "unlock/extra-light": unlockExtraLightUrl,
  "unlock/hand-size-per-act": unlockHandSizePerActUrl,
  "unlock/keyword-bonus": unlockKeywordBonusUrl,
  "unlock/min-energy": unlockMinEnergyUrl,
  "unlock/min-light": unlockMinLightUrl,
  "unlock/starter-footballer": unlockStarterFootballerUrl,
  "world-select-bg": worldSelectBgUrl,
  "screen-chronicle": screenChronicleUrl,
  "screen-destiny": screenDestinyUrl,
  "screen-lose": screenLoseUrl,
  ...worldAssetUrls,
};

export function loadAssets(scene: Phaser.Scene) {
  for (const [key, url] of Object.entries(assetManifest)) {
    if (url !== undefined) {
      scene.load.image(key, url);
    }
  }

  scene.load.on("loaderror", (file: Phaser.Loader.File) => {
    console.warn(`Asset failed to load: ${file.key}`);
  });
}
