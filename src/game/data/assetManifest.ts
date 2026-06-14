/// <reference types="vite/client" />
import cardbackUrl from "../assets/cardback.webp";
import cardfrontUrl from "../assets/cardfront.webp";
import walkerUrl from "../assets/walker.webp";
import doorUrl from "../assets/door.webp";
import doorGlowUrl from "../assets/door-glow.webp";
import textBackUrl from "../assets/text-background.webp";
import insetFrameUrl from "../assets/inset-frame.webp";
import energyIconUrl from "../assets/energy.webp";
import effectIconBraceUrl from "../assets/effect-icons/effect-icon-brace.png";
import effectIconProgressUrl from "../assets/effect-icons/effect-icon-progress.png";
import effectIconProgressAllUrl from "../assets/effect-icons/effect-icon-progress-all.png";
import effectIconDrawUrl from "../assets/effect-icons/effect-icon-draw.png";
import effectIconWorldDrawUrl from "../assets/effect-icons/effect-icon-world-draw.png";
import effectIconHpUrl from "../assets/effect-icons/effect-icon-hp.png";
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
import worldSelectBgUrl from "../assets/world-select.webp";
import { worldAssetUrls } from "../worlds/assetBindings";

export const assetManifest: Record<string, string> = {
  cardback: cardbackUrl,
  cardfront: cardfrontUrl,
  walker: walkerUrl,
  door: doorUrl,
  "door-glow": doorGlowUrl,
  "text-back": textBackUrl,
  "inset-frame": insetFrameUrl,
  "energy-icon": energyIconUrl,
  "effect-icon-brace": effectIconBraceUrl,
  "effect-icon-progress": effectIconProgressUrl,
  "effect-icon-progress-all": effectIconProgressAllUrl,
  "effect-icon-draw": effectIconDrawUrl,
  "effect-icon-world-draw": effectIconWorldDrawUrl,
  "effect-icon-hp": effectIconHpUrl,
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
  "world-select-bg": worldSelectBgUrl,
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
