/// <reference types="vite/client" />
import cardbackUrl from "../assets/cardback.webp";
import cardfrontUrl from "../assets/cardfront.webp";
import walkerUrl from "../assets/walker.webp";
import doorUrl from "../assets/door.webp";
import doorGlowUrl from "../assets/door-glow.webp";
import textBackUrl from "../assets/text-background.webp";
import insetFrameUrl from "../assets/inset-frame.webp";
import energyIconUrl from "../assets/energy.webp";
import powerBraceUrl from "../assets/power-brace.png";
import powerForceDestroyUrl from "../assets/power-force-destroy.png";
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
import effectIconThreatUrl from "../assets/effect-icons/effect-icon-threat.png";
import effectIconSurviveUrl from "../assets/effect-icons/effect-icon-survive.png";
import effectIconVanishUrl from "../assets/effect-icons/effect-icon-vanish.png";
import effectIconEachTurnUrl from "../assets/effect-icons/effect-icon-each-turn.png";
import effectIconOnClearUrl from "../assets/effect-icons/effect-icon-on-clear.png";
import effectIconOnPartialClearUrl from "../assets/effect-icons/effect-icon-on-partial-clear.png";
import bigboxRealityUrl from "../assets/themes/zombie-big-box/bigbox-reality.webp";
import zombieIntrusionUrl from "../assets/themes/zombie-big-box/intrusion-overlay.webp";
import zombieCardfrontUrl from "../assets/themes/zombie-big-box/zombie-cardfront.webp";
import birdRealityUrl from "../assets/themes/bird-building/bird-building-bg.webp";
import birdOverlayUrl from "../assets/themes/bird-building/bird-building-overlay.webp";
import birdCardfrontUrl from "../assets/themes/bird-building/bird-building-cardfront.webp";
import birdInsetCutItLooseUrl from "../assets/themes/bird-building/insets/inset-cut-it-loose.webp";
import birdInsetFindFootingUrl from "../assets/themes/bird-building/insets/inset-find-footing.webp";
import birdInsetFireAxeUrl from "../assets/themes/bird-building/insets/inset-fire-axe.webp";
import birdInsetFireAxeFindUrl from "../assets/themes/bird-building/insets/inset-fire-axe-find.webp";
import birdInsetGrippingTalonUrl from "../assets/themes/bird-building/insets/inset-gripping-talon.webp";
import birdInsetGroaningGirdersUrl from "../assets/themes/bird-building/insets/inset-groaning-girders.webp";
import birdInsetShadowOverheadUrl from "../assets/themes/bird-building/insets/inset-shadow-overhead.webp";
import birdInsetSlidingDebrisUrl from "../assets/themes/bird-building/insets/inset-sliding-debris.webp";
import birdInsetSteadyUrl from "../assets/themes/bird-building/insets/inset-steady.webp";
import volcanoRealityUrl from "../assets/themes/highway-volcano/highway-volcano-bg.webp";
import volcanoOverlayUrl from "../assets/themes/highway-volcano/highway-volcano-overlay.webp";
import volcanoCardfrontUrl from "../assets/themes/highway-volcano/highway-volcano-cardfront.webp";
import volcanoInsetAshFallUrl from "../assets/themes/highway-volcano/insets/inset-ash-fall.webp";
import volcanoInsetDitchGearUrl from "../assets/themes/highway-volcano/insets/inset-ditch-gear.webp";
import volcanoInsetFloorItUrl from "../assets/themes/highway-volcano/insets/inset-floor-it.webp";
import volcanoInsetGridlockUrl from "../assets/themes/highway-volcano/insets/inset-gridlock.webp";
import volcanoInsetLavaFlowUrl from "../assets/themes/highway-volcano/insets/inset-lava-flow.webp";
import volcanoInsetNitroUrl from "../assets/themes/highway-volcano/insets/inset-nitro.webp";
import volcanoInsetSpotPathUrl from "../assets/themes/highway-volcano/insets/inset-spot-path.webp";
import volcanoInsetTremorsUrl from "../assets/themes/highway-volcano/insets/inset-tremors.webp";
import volcanoInsetVehicleUrl from "../assets/themes/highway-volcano/insets/inset-vehicle.webp";
import mallRealityUrl from "../assets/themes/overgrown-mall/overgrown-mall-reality.webp";
import mallOverlayUrl from "../assets/themes/overgrown-mall/intrusion-overlay.webp";
import mallCardfrontUrl from "../assets/themes/overgrown-mall/overgrown-mall-cardfront.webp";
import mallInsetBloomUrl from "../assets/themes/overgrown-mall/insets/inset-bloom.webp";
import mallInsetBurstPlanterUrl from "../assets/themes/overgrown-mall/insets/inset-burst-planter.webp";
import mallInsetFountainBloomUrl from "../assets/themes/overgrown-mall/insets/inset-fountain-bloom.webp";
import mallInsetGardenCenterUrl from "../assets/themes/overgrown-mall/insets/inset-garden-center.webp";
import mallInsetKudzuCurtainUrl from "../assets/themes/overgrown-mall/insets/inset-kudzu-curtain.webp";
import mallInsetMacheteUrl from "../assets/themes/overgrown-mall/insets/inset-machete.webp";
import mallInsetPollenHazeUrl from "../assets/themes/overgrown-mall/insets/inset-pollen-haze.webp";
import mallInsetPruningShearsUrl from "../assets/themes/overgrown-mall/insets/inset-pruning-shears.webp";
import mallInsetSomethingInTheAtriumUrl from "../assets/themes/overgrown-mall/insets/inset-something-in-the-atrium.webp";
import mallInsetSporeUrl from "../assets/themes/overgrown-mall/insets/inset-spore.webp";
import mallInsetWeedKillerUrl from "../assets/themes/overgrown-mall/insets/inset-weed-killer.webp";
import insetSprintUrl from "../assets/insets/inset-sprint.webp";
import insetExploreUrl from "../assets/insets/inset-explore.webp";
import insetBarricadeUrl from "../assets/insets/inset-barricade.webp";
import insetMedKitUrl from "../assets/insets/inset-medkit.webp";
import insetPanicUrl from "../assets/insets/inset-panic.webp";
import insetAdrenalineUrl from "../assets/insets/inset-adrenaline.webp";
import insetDoorUrl from "../assets/insets/inset-door.webp";
import insetWalkerUrl from "../assets/insets/inset-walker.webp";
import zombieInsetBaseballUrl from "../assets/themes/zombie-big-box/insets/inset-baseball.webp";
import zombieInsetCorpseUrl from "../assets/themes/zombie-big-box/insets/inset-corpse.webp";
import zombieInsetEchoingAislesUrl from "../assets/themes/zombie-big-box/insets/inset-echoing-aisles.webp";
import zombieInsetFindShotgunUrl from "../assets/themes/zombie-big-box/insets/inset-find-shotgun.webp";
import zombieInsetRegroupUrl from "../assets/themes/zombie-big-box/insets/inset-regroup.webp";
import zombieInsetRubbleUrl from "../assets/themes/zombie-big-box/insets/inset-rubble.webp";
import zombieInsetScreamsUrl from "../assets/themes/zombie-big-box/insets/inset-screams.webp";
import zombieInsetShelfSweepUrl from "../assets/themes/zombie-big-box/insets/inset-shelf-sweep.webp";
import zombieInsetShotgunUrl from "../assets/themes/zombie-big-box/insets/inset-shotgun.webp";
import zombieInsetStrangeSoundsUrl from "../assets/themes/zombie-big-box/insets/inset-strange-sounds.webp";
import zombieInsetZombieUrl from "../assets/themes/zombie-big-box/insets/inset-zombie.webp";
import zombieInsetListenUrl from "../assets/themes/zombie-big-box/insets/inset-listen.webp";
import starterJsonUrl from "../../data/worlds/starter.json?url";
import zombieJsonUrl from "../../data/worlds/zombie-big-box.json?url";
import birdJsonUrl from "../../data/worlds/bird-building.json?url";
import volcanoJsonUrl from "../../data/worlds/highway-volcano.json?url";
import mallJsonUrl from "../../data/worlds/overgrown-mall.json?url";
import worldSelectBgUrl from "../assets/world-select.webp";

export const assetManifest: Record<string, string> = {
  cardback: cardbackUrl,
  cardfront: cardfrontUrl,
  walker: walkerUrl,
  door: doorUrl,
  "door-glow": doorGlowUrl,
  "text-back": textBackUrl,
  "inset-frame": insetFrameUrl,
  "energy-icon": energyIconUrl,
  "power-brace": powerBraceUrl,
  "power-force-destroy": powerForceDestroyUrl,
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
  "effect-icon-threat": effectIconThreatUrl,
  "effect-icon-survive": effectIconSurviveUrl,
  "effect-icon-vanish": effectIconVanishUrl,
  "effect-icon-each-turn": effectIconEachTurnUrl,
  "effect-icon-on-clear": effectIconOnClearUrl,
  "effect-icon-on-partial-clear": effectIconOnPartialClearUrl,
  "bigbox-reality": bigboxRealityUrl,
  "zombie-intrusion": zombieIntrusionUrl,
  "zombie-cardfront": zombieCardfrontUrl,
  "bird-building-bg": birdRealityUrl,
  "bird-building-overlay": birdOverlayUrl,
  "bird-building-cardfront": birdCardfrontUrl,
  "bird-inset-cut-it-loose": birdInsetCutItLooseUrl,
  "bird-inset-find-footing": birdInsetFindFootingUrl,
  "bird-inset-fire-axe": birdInsetFireAxeUrl,
  "bird-inset-fire-axe-find": birdInsetFireAxeFindUrl,
  "bird-inset-gripping-talon": birdInsetGrippingTalonUrl,
  "bird-inset-groaning-girders": birdInsetGroaningGirdersUrl,
  "bird-inset-shadow-overhead": birdInsetShadowOverheadUrl,
  "bird-inset-sliding-debris": birdInsetSlidingDebrisUrl,
  "bird-inset-steady": birdInsetSteadyUrl,
  "highway-volcano-bg": volcanoRealityUrl,
  "highway-volcano-overlay": volcanoOverlayUrl,
  "highway-volcano-cardfront": volcanoCardfrontUrl,
  "volcano-inset-ash-fall": volcanoInsetAshFallUrl,
  "volcano-inset-ditch-gear": volcanoInsetDitchGearUrl,
  "volcano-inset-floor-it": volcanoInsetFloorItUrl,
  "volcano-inset-gridlock": volcanoInsetGridlockUrl,
  "volcano-inset-lava-flow": volcanoInsetLavaFlowUrl,
  "volcano-inset-nitro": volcanoInsetNitroUrl,
  "volcano-inset-spot-path": volcanoInsetSpotPathUrl,
  "volcano-inset-tremors": volcanoInsetTremorsUrl,
  "volcano-inset-vehicle": volcanoInsetVehicleUrl,
  "overgrown-mall-bg": mallRealityUrl,
  "overgrown-mall-overlay": mallOverlayUrl,
  "overgrown-mall-cardfront": mallCardfrontUrl,
  "mall-inset-spore": mallInsetSporeUrl,
  "mall-inset-burst-planter": mallInsetBurstPlanterUrl,
  "mall-inset-pollen-haze": mallInsetPollenHazeUrl,
  "mall-inset-kudzu-curtain": mallInsetKudzuCurtainUrl,
  "mall-inset-something-in-the-atrium": mallInsetSomethingInTheAtriumUrl,
  "mall-inset-fountain-bloom": mallInsetFountainBloomUrl,
  "mall-inset-garden-center": mallInsetGardenCenterUrl,
  "mall-inset-pruning-shears": mallInsetPruningShearsUrl,
  "mall-inset-machete": mallInsetMacheteUrl,
  "mall-inset-weed-killer": mallInsetWeedKillerUrl,
  "mall-inset-bloom": mallInsetBloomUrl,
  "inset-sprint": insetSprintUrl,
  "inset-explore": insetExploreUrl,
  "inset-barricade": insetBarricadeUrl,
  "inset-medkit": insetMedKitUrl,
  "inset-panic": insetPanicUrl,
  "inset-adrenaline": insetAdrenalineUrl,
  "inset-door": insetDoorUrl,
  "inset-walker": insetWalkerUrl,
  "zombie-inset-baseball": zombieInsetBaseballUrl,
  "zombie-inset-corpse": zombieInsetCorpseUrl,
  "zombie-inset-echoing-aisles": zombieInsetEchoingAislesUrl,
  "zombie-inset-find-shotgun": zombieInsetFindShotgunUrl,
  "zombie-inset-regroup": zombieInsetRegroupUrl,
  "zombie-inset-rubble": zombieInsetRubbleUrl,
  "zombie-inset-screams": zombieInsetScreamsUrl,
  "zombie-inset-shelf-sweep": zombieInsetShelfSweepUrl,
  "zombie-inset-shotgun": zombieInsetShotgunUrl,
  "zombie-inset-listen": zombieInsetListenUrl,
  "zombie-inset-strange-sounds": zombieInsetStrangeSoundsUrl,
  "zombie-inset-zombie": zombieInsetZombieUrl,
  "world-select-bg": worldSelectBgUrl,
  // JSON files are loaded as URLs so Phaser can load them asynchronously.
  "world-starter": starterJsonUrl,
  "world-zombie-big-box": zombieJsonUrl,
  "world-bird-building": birdJsonUrl,
  "world-highway-volcano": volcanoJsonUrl,
  "world-overgrown-mall": mallJsonUrl,
};

export function loadAssets(scene: Phaser.Scene) {
  for (const [key, url] of Object.entries(assetManifest)) {
    if (url !== undefined) {
      if (url.endsWith(".json")) {
        scene.load.json(key, url);
      } else {
        scene.load.image(key, url);
      }
    }
  }

  scene.load.on("loaderror", (file: Phaser.Loader.File) => {
    console.warn(`Asset failed to load: ${file.key}`);
  });
}
