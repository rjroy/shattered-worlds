/// <reference types="vite/client" />

// ---------------------------------------------------------------------------
// World backdrop, overlay, and cardfront imports
// ---------------------------------------------------------------------------

import bigboxRealityUrl from "../assets/themes/zombie-big-box/bigbox-reality.webp";
import zombieIntrusionUrl from "../assets/themes/zombie-big-box/intrusion-overlay.webp";
import zombieCardfrontUrl from "../assets/themes/zombie-big-box/zombie-cardfront.webp";

import birdRealityUrl from "../assets/themes/bird-building/bird-building-bg.webp";
import birdOverlayUrl from "../assets/themes/bird-building/bird-building-overlay.webp";
import birdCardfrontUrl from "../assets/themes/bird-building/bird-building-cardfront.webp";

import volcanoRealityUrl from "../assets/themes/highway-volcano/highway-volcano-bg.webp";
import volcanoOverlayUrl from "../assets/themes/highway-volcano/highway-volcano-overlay.webp";
import volcanoCardfrontUrl from "../assets/themes/highway-volcano/highway-volcano-cardfront.webp";

import mallRealityUrl from "../assets/themes/overgrown-mall/overgrown-mall-reality.webp";
import mallOverlayUrl from "../assets/themes/overgrown-mall/intrusion-overlay.webp";
import mallCardfrontUrl from "../assets/themes/overgrown-mall/overgrown-mall-cardfront.webp";

import fogRealityUrl from "../assets/themes/fog-beach-party/fog-beach-party-reality.webp";
import fogOverlayUrl from "../assets/themes/fog-beach-party/intrusion-overlay.webp";
import fogCardfrontUrl from "../assets/themes/fog-beach-party/fog-beach-party-cardfront.webp";

// ---------------------------------------------------------------------------
// World inset imports
// ---------------------------------------------------------------------------

import birdInsetCutItLooseUrl from "../assets/themes/bird-building/insets/inset-cut-it-loose.webp";
import birdInsetFindFootingUrl from "../assets/themes/bird-building/insets/inset-find-footing.webp";
import birdInsetFireAxeUrl from "../assets/themes/bird-building/insets/inset-fire-axe.webp";
import birdInsetFireAxeFindUrl from "../assets/themes/bird-building/insets/inset-fire-axe-find.webp";
import birdInsetGrippingTalonUrl from "../assets/themes/bird-building/insets/inset-gripping-talon.webp";
import birdInsetGroaningGirdersUrl from "../assets/themes/bird-building/insets/inset-groaning-girders.webp";
import birdInsetShadowOverheadUrl from "../assets/themes/bird-building/insets/inset-shadow-overhead.webp";
import birdInsetSlidingDebrisUrl from "../assets/themes/bird-building/insets/inset-sliding-debris.webp";
import birdInsetSteadyUrl from "../assets/themes/bird-building/insets/inset-steady.webp";

import volcanoInsetAshFallUrl from "../assets/themes/highway-volcano/insets/inset-ash-fall.webp";
import volcanoInsetDitchGearUrl from "../assets/themes/highway-volcano/insets/inset-ditch-gear.webp";
import volcanoInsetFloorItUrl from "../assets/themes/highway-volcano/insets/inset-floor-it.webp";
import volcanoInsetGridlockUrl from "../assets/themes/highway-volcano/insets/inset-gridlock.webp";
import volcanoInsetLavaFlowUrl from "../assets/themes/highway-volcano/insets/inset-lava-flow.webp";
import volcanoInsetNitroUrl from "../assets/themes/highway-volcano/insets/inset-nitro.webp";
import volcanoInsetSpotPathUrl from "../assets/themes/highway-volcano/insets/inset-spot-path.webp";
import volcanoInsetTremorsUrl from "../assets/themes/highway-volcano/insets/inset-tremors.webp";
import volcanoInsetVehicleUrl from "../assets/themes/highway-volcano/insets/inset-vehicle.webp";

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

import fogInsetAbandonedCoolerUrl from "../assets/themes/fog-beach-party/insets/inset-abandoned-cooler.webp";
import fogInsetBonfireUrl from "../assets/themes/fog-beach-party/insets/inset-bonfire.webp";
import fogInsetFlareGunUrl from "../assets/themes/fog-beach-party/insets/inset-flare-gun.webp";
import fogInsetFlashlightUrl from "../assets/themes/fog-beach-party/insets/inset-flashlight.webp";
import fogInsetRollingFogUrl from "../assets/themes/fog-beach-party/insets/inset-rolling-fog.webp";
import fogInsetSearchlightUrl from "../assets/themes/fog-beach-party/insets/inset-searchlight.webp";
import fogInsetSomethingInTheMistUrl from "../assets/themes/fog-beach-party/insets/inset-something-in-the-mist.webp";
import fogInsetTheBonfireUrl from "../assets/themes/fog-beach-party/insets/inset-the-bonfire.webp";
import fogInsetTheTideComingInUrl from "../assets/themes/fog-beach-party/insets/inset-the-tide-coming-in.webp";
import fogInsetWhiteoutUrl from "../assets/themes/fog-beach-party/insets/inset-whiteout.webp";

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

// ---------------------------------------------------------------------------
// World music imports
// ---------------------------------------------------------------------------

import zombieBigBoxMusicUrl from "../assets/audio/zombie-big-box-music.mp3?url";
import birdBuildingMusicUrl from "../assets/audio/bird-building-music.mp3?url";
import highwayVolcanoMusicUrl from "../assets/audio/highway-volcano-music.mp3?url";
import overgrownMallMusicUrl from "../assets/audio/overgrown-mall-music.mp3?url";
// Placeholder music until a dedicated Fog track ships (precedent: insets ship as
// placeholders). Reuses the mall track under the distinct fog music key so the
// world loads and the asset-binding conformance test passes.
import fogBeachPartyMusicUrl from "../assets/audio/overgrown-mall-music.mp3?url";

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** All asset keys for world-scoped images, keyed the same as assetManifest. */
export const worldAssetUrls: Record<string, string> = {
  // zombie-big-box
  "bigbox-reality": bigboxRealityUrl,
  "zombie-intrusion": zombieIntrusionUrl,
  "zombie-cardfront": zombieCardfrontUrl,
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
  // bird-building
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
  // highway-volcano
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
  // overgrown-mall
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
  // fog-beach-party
  "fog-beach-party-bg": fogRealityUrl,
  "fog-beach-party-overlay": fogOverlayUrl,
  "fog-beach-party-cardfront": fogCardfrontUrl,
  "fog-inset-flashlight": fogInsetFlashlightUrl,
  "fog-inset-flare-gun": fogInsetFlareGunUrl,
  "fog-inset-bonfire": fogInsetBonfireUrl,
  "fog-inset-searchlight": fogInsetSearchlightUrl,
  "fog-inset-rolling-fog": fogInsetRollingFogUrl,
  "fog-inset-abandoned-cooler": fogInsetAbandonedCoolerUrl,
  "fog-inset-the-bonfire": fogInsetTheBonfireUrl,
  "fog-inset-something-in-the-mist": fogInsetSomethingInTheMistUrl,
  "fog-inset-the-tide-coming-in": fogInsetTheTideComingInUrl,
  "fog-inset-whiteout": fogInsetWhiteoutUrl,
};

export interface WorldMusicAsset {
  key: string;
  url: string;
}

/** Music binding for each worldId. */
export const worldMusicManifest: Record<string, WorldMusicAsset> = {
  "zombie-big-box": { key: "music-zombie-big-box", url: zombieBigBoxMusicUrl },
  "bird-building": { key: "music-bird-building", url: birdBuildingMusicUrl },
  "highway-volcano": { key: "music-highway-volcano", url: highwayVolcanoMusicUrl },
  "overgrown-mall": { key: "music-overgrown-mall", url: overgrownMallMusicUrl },
  "fog-beach-party": { key: "music-fog-beach-party", url: fogBeachPartyMusicUrl },
};
