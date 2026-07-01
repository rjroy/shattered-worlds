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

import whiteoutRealityUrl from "../assets/themes/whiteout-parking-garage/whiteout-parking-garage-reality.webp";
import whiteoutOverlayUrl from "../assets/themes/whiteout-parking-garage/intrusion-overlay.webp";
import whiteoutCardfrontUrl from "../assets/themes/whiteout-parking-garage/whiteout-parking-garage-cardfront.webp";

import tidalRealityUrl from "../assets/themes/the-tidal-archive/the-tidal-archive-reality.webp";
import tidalOverlayUrl from "../assets/themes/the-tidal-archive/intrusion-overlay.webp";
import tidalCardfrontUrl from "../assets/themes/the-tidal-archive/the-tidal-archive-cardfront.webp";

import emberRealityUrl from "../assets/themes/the-ember-orchard/the-ember-orchard-reality.webp";
import emberOverlayUrl from "../assets/themes/the-ember-orchard/intrusion-overlay.webp";
import emberCardfrontUrl from "../assets/themes/the-ember-orchard/the-ember-orchard-cardfront.webp";

import giantsRealityUrl from "../assets/themes/city-of-sleeping-giants/city-of-sleeping-giants-reality.webp";
import giantsOverlayUrl from "../assets/themes/city-of-sleeping-giants/intrusion-overlay.webp";
import giantsCardfrontUrl from "../assets/themes/city-of-sleeping-giants/city-of-sleeping-giants-cardfront.webp";

import edenRealityUrl from "../assets/themes/eden-prime/eden-prime-reality.webp";
import edenOverlayUrl from "../assets/themes/eden-prime/intrusion-overlay.webp";
import edenCardfrontUrl from "../assets/themes/eden-prime/eden-prime-cardfront.webp";
import derelictRealityUrl from "../assets/themes/new-derelict/new-derelict-reality.webp";
import derelictOverlayUrl from "../assets/themes/new-derelict/intrusion-overlay.webp";
import derelictCardfrontUrl from "../assets/themes/new-derelict/new-derelict-cardfront.webp";

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

import whiteoutInsetBlackIceRampUrl from "../assets/themes/whiteout-parking-garage/insets/inset-black-ice-ramp.webp";
import whiteoutInsetBurnTheManualUrl from "../assets/themes/whiteout-parking-garage/insets/inset-burn-the-manual.webp";
import whiteoutInsetDeadBatteryUrl from "../assets/themes/whiteout-parking-garage/insets/inset-dead-battery.webp";
import whiteoutInsetFrozenPuddleUrl from "../assets/themes/whiteout-parking-garage/insets/inset-frozen-puddle.webp";
import whiteoutInsetHandWarmersUrl from "../assets/themes/whiteout-parking-garage/insets/inset-hand-warmers.webp";
import whiteoutInsetIceLockedDoorUrl from "../assets/themes/whiteout-parking-garage/insets/inset-ice-locked-door.webp";
import whiteoutInsetIceScraperUrl from "../assets/themes/whiteout-parking-garage/insets/inset-ice-scraper.webp";
import whiteoutInsetJumperCablesUrl from "../assets/themes/whiteout-parking-garage/insets/inset-jumper-cables.webp";
import whiteoutInsetMaintenanceClosetUrl from "../assets/themes/whiteout-parking-garage/insets/inset-maintenance-closet.webp";
import whiteoutInsetPlowBuriedInSnowUrl from "../assets/themes/whiteout-parking-garage/insets/inset-plow-buried-in-snow.webp";
import whiteoutInsetPowderDriftUrl from "../assets/themes/whiteout-parking-garage/insets/inset-powder-drift.webp";
import whiteoutInsetSnowblindHeadlightsUrl from "../assets/themes/whiteout-parking-garage/insets/inset-snowblind-headlights.webp";
import whiteoutInsetSpaceHeaterUrl from "../assets/themes/whiteout-parking-garage/insets/inset-space-heater.webp";
import whiteoutInsetTheGarageFreezesShutUrl from "../assets/themes/whiteout-parking-garage/insets/inset-the-garage-freezes-shut.webp";

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
import zombieInsetPlanUrl from "../assets/themes/zombie-big-box/insets/inset-plan.webp";

import tidalInsetWanderingStacksUrl from "../assets/themes/the-tidal-archive/insets/inset-wandering-stacks.webp";
import tidalInsetDrownedIndexUrl from "../assets/themes/the-tidal-archive/insets/inset-drowned-index.webp";
import tidalInsetMisfiledCenturyUrl from "../assets/themes/the-tidal-archive/insets/inset-misfiled-century.webp";
import tidalInsetBridgeToYesterdayUrl from "../assets/themes/the-tidal-archive/insets/inset-bridge-to-yesterday.webp";
import tidalInsetBorrowedCatastropheUrl from "../assets/themes/the-tidal-archive/insets/inset-borrowed-catastrophe.webp";
import tidalInsetChainedBooksRisingUrl from "../assets/themes/the-tidal-archive/insets/inset-chained-books-rising.webp";
import tidalInsetTheSameFootprintUrl from "../assets/themes/the-tidal-archive/insets/inset-the-same-footprint.webp";
import tidalInsetMarkTheShelfUrl from "../assets/themes/the-tidal-archive/insets/inset-mark-the-shelf.webp";
import tidalInsetCrossReferenceUrl from "../assets/themes/the-tidal-archive/insets/inset-cross-reference.webp";
import tidalInsetWaterproofNotesUrl from "../assets/themes/the-tidal-archive/insets/inset-waterproof-notes.webp";
import tidalInsetAnchorTheMemoryUrl from "../assets/themes/the-tidal-archive/insets/inset-anchor-the-memory.webp";
import tidalInsetShelfMapUrl from "../assets/themes/the-tidal-archive/insets/inset-shelf-map.webp";

import emberInsetCrackedHearthStarUrl from "../assets/themes/the-ember-orchard/insets/inset-cracked-hearth-star.webp";
import emberInsetDormantStarUrl from "../assets/themes/the-ember-orchard/insets/inset-dormant-star.webp";
import emberInsetEmberMothUrl from "../assets/themes/the-ember-orchard/insets/inset-ember-moth.webp";
import emberInsetFallingFruitUrl from "../assets/themes/the-ember-orchard/insets/inset-falling-fruit.webp";
import emberInsetGlasshouseLanternUrl from "../assets/themes/the-ember-orchard/insets/inset-glasshouse-lantern.webp";
import emberInsetGroundConstellationUrl from "../assets/themes/the-ember-orchard/insets/inset-ground-constellation.webp";
import emberInsetHatcheryCellarUrl from "../assets/themes/the-ember-orchard/insets/inset-hatchery-cellar.webp";
import emberInsetLanternBroodUrl from "../assets/themes/the-ember-orchard/insets/inset-lantern-brood.webp";
import emberInsetRootedMeteorUrl from "../assets/themes/the-ember-orchard/insets/inset-rooted-meteor.webp";
import emberInsetTakeOneUrl from "../assets/themes/the-ember-orchard/insets/inset-take-one.webp";
import emberInsetTheOrchardCountsWrongUrl from "../assets/themes/the-ember-orchard/insets/inset-the-orchard-counts-wrong.webp";
import emberInsetBankTheHeatUrl from "../assets/themes/the-ember-orchard/insets/inset-bank-the-heat.webp";
import emberInsetConstellationShearsUrl from "../assets/themes/the-ember-orchard/insets/inset-constellation-shears.webp";
import emberInsetKeepVigilUrl from "../assets/themes/the-ember-orchard/insets/inset-keep-vigil.webp";
import emberInsetLeaveOneUrl from "../assets/themes/the-ember-orchard/insets/inset-leave-one.webp";
import emberInsetStarPrunerUrl from "../assets/themes/the-ember-orchard/insets/inset-star-pruner.webp";

import giantsInsetMinorTremorUrl from "../assets/themes/city-of-sleeping-giants/insets/inset-minor-tremor.webp";
import giantsInsetRelocationOrderUrl from "../assets/themes/city-of-sleeping-giants/insets/inset-relocation-order.webp";
import giantsInsetFingerquakeWardUrl from "../assets/themes/city-of-sleeping-giants/insets/inset-fingerquake-ward.webp";
import giantsInsetSurveyorsMarkAPulseUrl from "../assets/themes/city-of-sleeping-giants/insets/inset-surveyors-mark-a-pulse.webp";
import giantsInsetVeinRoadSurgeUrl from "../assets/themes/city-of-sleeping-giants/insets/inset-vein-road-surge.webp";
import giantsInsetBoneAnchorFailureUrl from "../assets/themes/city-of-sleeping-giants/insets/inset-bone-anchor-failure.webp";
import giantsInsetDistrictRecallUrl from "../assets/themes/city-of-sleeping-giants/insets/inset-district-recall.webp";
import giantsInsetTheGiantTurnsInSleepUrl from "../assets/themes/city-of-sleeping-giants/insets/inset-the-giant-turns-in-sleep.webp";
import giantsInsetFollowTheVeinUrl from "../assets/themes/city-of-sleeping-giants/insets/inset-follow-the-vein.webp";
import giantsInsetQuietSurveyUrl from "../assets/themes/city-of-sleeping-giants/insets/inset-quiet-survey.webp";
import giantsInsetBraceTheWardUrl from "../assets/themes/city-of-sleeping-giants/insets/inset-brace-the-ward.webp";
import giantsInsetBonePinUrl from "../assets/themes/city-of-sleeping-giants/insets/inset-bone-pin.webp";
import giantsInsetContourMapUrl from "../assets/themes/city-of-sleeping-giants/insets/inset-contour-map.webp";

import edenInsetFruitOfferedTooQuicklyUrl from "../assets/themes/eden-prime/insets/inset-fruit-offered-too-quickly.webp";
import edenInsetFirstWarningCryUrl from "../assets/themes/eden-prime/insets/inset-first-warning-cry.webp";
import edenInsetCuriousSwarmUrl from "../assets/themes/eden-prime/insets/inset-curious-swarm.webp";
import edenInsetTheHerdMisunderstandsUrl from "../assets/themes/eden-prime/insets/inset-the-herd-misunderstands.webp";
import edenInsetFlowersFaceTheWrongSunUrl from "../assets/themes/eden-prime/insets/inset-flowers-face-the-wrong-sun.webp";
import edenInsetTheQuietGroveUrl from "../assets/themes/eden-prime/insets/inset-the-quiet-grove.webp";
import edenInsetParadiseRunsUrl from "../assets/themes/eden-prime/insets/inset-paradise-runs.webp";
import edenInsetTakeTheFruitUrl from "../assets/themes/eden-prime/insets/inset-take-the-fruit.webp";
import edenInsetGentleApproachUrl from "../assets/themes/eden-prime/insets/inset-gentle-approach.webp";
import edenInsetStillnessLessonUrl from "../assets/themes/eden-prime/insets/inset-stillness-lesson.webp";
import edenInsetFollowTheShadeUrl from "../assets/themes/eden-prime/insets/inset-follow-the-shade.webp";
import edenInsetHushTheValleyUrl from "../assets/themes/eden-prime/insets/inset-hush-the-valley.webp";
import edenInsetTreadSoftlyUrl from "../assets/themes/eden-prime/insets/inset-tread-softly.webp";
import derelictInsetBulkheadUrl from "../assets/themes/new-derelict/insets/inset-bulkhead-7-c-seals.webp";
import derelictInsetAddressUrl from "../assets/themes/new-derelict/insets/inset-unfinished-captains-address.webp";
import derelictInsetGravityUrl from "../assets/themes/new-derelict/insets/inset-gravity-priority-shift.webp";
import derelictInsetMisfileUrl from "../assets/themes/new-derelict/insets/inset-administrative-misfile.webp";
import derelictInsetLifeboatUrl from "../assets/themes/new-derelict/insets/inset-corridor-becomes-lifeboat.webp";
import derelictInsetPanelUrl from "../assets/themes/new-derelict/insets/inset-systems-panel.webp";
import derelictInsetOrderUrl from "../assets/themes/new-derelict/insets/inset-the-order-arrives.webp";
import derelictInsetRouteUrl from "../assets/themes/new-derelict/insets/inset-emergency-route.webp";
import derelictInsetBadgeUrl from "../assets/themes/new-derelict/insets/inset-override-badge.webp";
import derelictInsetReleaseUrl from "../assets/themes/new-derelict/insets/inset-manual-release.webp";
import derelictInsetChecklistUrl from "../assets/themes/new-derelict/insets/inset-follow-the-checklist.webp";

// ---------------------------------------------------------------------------
// World music imports
// ---------------------------------------------------------------------------

import zombieBigBoxMusicUrl from "../assets/audio/zombie-big-box-music.mp3?url";
import birdBuildingMusicUrl from "../assets/audio/bird-building-music.mp3?url";
import highwayVolcanoMusicUrl from "../assets/audio/highway-volcano-music.mp3?url";
import overgrownMallMusicUrl from "../assets/audio/overgrown-mall-music.mp3?url";
import fogBeachPartyMusicUrl from "../assets/audio/fog-beach-party-music.mp3?url";
import whiteoutMusicUrl from "../assets/audio/whiteout-parking-garage-music.mp3?url";
import orchardMusicUrl from "../assets/audio/the-ember-orchard-music.mp3?url";
import tidalMusicUrl from "../assets/audio/the-tidal-archive-music.mp3?url";
import giantsMusicUrl from "../assets/audio/city-of-sleeping-giants-music.mp3?url";
import edenPrimeMusicUrl from "../assets/audio/eden-prime-music.mp3?url";

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
  "zombie-inset-plan": zombieInsetPlanUrl,
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
  // whiteout-parking-garage
  "whiteout-parking-garage-bg": whiteoutRealityUrl,
  "whiteout-parking-garage-overlay": whiteoutOverlayUrl,
  "whiteout-parking-garage-cardfront": whiteoutCardfrontUrl,
  "whiteout-inset-hand-warmers": whiteoutInsetHandWarmersUrl,
  "whiteout-inset-ice-scraper": whiteoutInsetIceScraperUrl,
  "whiteout-inset-burn-the-manual": whiteoutInsetBurnTheManualUrl,
  "whiteout-inset-space-heater": whiteoutInsetSpaceHeaterUrl,
  "whiteout-inset-jumper-cables": whiteoutInsetJumperCablesUrl,
  "whiteout-inset-maintenance-closet": whiteoutInsetMaintenanceClosetUrl,
  "whiteout-inset-powder-drift": whiteoutInsetPowderDriftUrl,
  "whiteout-inset-frozen-puddle": whiteoutInsetFrozenPuddleUrl,
  "whiteout-inset-dead-battery": whiteoutInsetDeadBatteryUrl,
  "whiteout-inset-black-ice-ramp": whiteoutInsetBlackIceRampUrl,
  "whiteout-inset-snowblind-headlights": whiteoutInsetSnowblindHeadlightsUrl,
  "whiteout-inset-ice-locked-door": whiteoutInsetIceLockedDoorUrl,
  "whiteout-inset-plow-buried-in-snow": whiteoutInsetPlowBuriedInSnowUrl,
  "whiteout-inset-the-garage-freezes-shut": whiteoutInsetTheGarageFreezesShutUrl,
  "the-tidal-archive-bg": tidalRealityUrl,
  "the-tidal-archive-overlay": tidalOverlayUrl,
  "the-tidal-archive-cardfront": tidalCardfrontUrl,
  "tidal-inset-wandering-stacks": tidalInsetWanderingStacksUrl,
  "tidal-inset-drowned-index": tidalInsetDrownedIndexUrl,
  "tidal-inset-misfiled-century": tidalInsetMisfiledCenturyUrl,
  "tidal-inset-bridge-to-yesterday": tidalInsetBridgeToYesterdayUrl,
  "tidal-inset-borrowed-catastrophe": tidalInsetBorrowedCatastropheUrl,
  "tidal-inset-chained-books-rising": tidalInsetChainedBooksRisingUrl,
  "tidal-inset-the-same-footprint": tidalInsetTheSameFootprintUrl,
  "tidal-inset-mark-the-shelf": tidalInsetMarkTheShelfUrl,
  "tidal-inset-cross-reference": tidalInsetCrossReferenceUrl,
  "tidal-inset-waterproof-notes": tidalInsetWaterproofNotesUrl,
  "tidal-inset-anchor-the-memory": tidalInsetAnchorTheMemoryUrl,
  "tidal-inset-shelf-map": tidalInsetShelfMapUrl,
  // the-ember-orchard
  "the-ember-orchard-bg": emberRealityUrl,
  "the-ember-orchard-overlay": emberOverlayUrl,
  "the-ember-orchard-cardfront": emberCardfrontUrl,
  "ember-inset-cracked-hearth-star": emberInsetCrackedHearthStarUrl,
  "ember-inset-dormant-star": emberInsetDormantStarUrl,
  "ember-inset-ember-moth": emberInsetEmberMothUrl,
  "ember-inset-falling-fruit": emberInsetFallingFruitUrl,
  "ember-inset-glasshouse-lantern": emberInsetGlasshouseLanternUrl,
  "ember-inset-ground-constellation": emberInsetGroundConstellationUrl,
  "ember-inset-hatchery-cellar": emberInsetHatcheryCellarUrl,
  "ember-inset-lantern-brood": emberInsetLanternBroodUrl,
  "ember-inset-rooted-meteor": emberInsetRootedMeteorUrl,
  "ember-inset-take-one": emberInsetTakeOneUrl,
  "ember-inset-the-orchard-counts-wrong": emberInsetTheOrchardCountsWrongUrl,
  "ember-inset-bank-the-heat": emberInsetBankTheHeatUrl,
  "ember-inset-constellation-shears": emberInsetConstellationShearsUrl,
  "ember-inset-keep-vigil": emberInsetKeepVigilUrl,
  "ember-inset-leave-one": emberInsetLeaveOneUrl,
  "ember-inset-star-pruner": emberInsetStarPrunerUrl,
  // city-of-sleeping-giants
  "city-of-sleeping-giants-bg": giantsRealityUrl,
  "city-of-sleeping-giants-overlay": giantsOverlayUrl,
  "city-of-sleeping-giants-cardfront": giantsCardfrontUrl,
  "giants-inset-minor-tremor": giantsInsetMinorTremorUrl,
  "giants-inset-relocation-order": giantsInsetRelocationOrderUrl,
  "giants-inset-fingerquake-ward": giantsInsetFingerquakeWardUrl,
  "giants-inset-surveyors-mark-a-pulse": giantsInsetSurveyorsMarkAPulseUrl,
  "giants-inset-vein-road-surge": giantsInsetVeinRoadSurgeUrl,
  "giants-inset-bone-anchor-failure": giantsInsetBoneAnchorFailureUrl,
  "giants-inset-district-recall": giantsInsetDistrictRecallUrl,
  "giants-inset-the-giant-turns-in-sleep": giantsInsetTheGiantTurnsInSleepUrl,
  "giants-inset-follow-the-vein": giantsInsetFollowTheVeinUrl,
  "giants-inset-quiet-survey": giantsInsetQuietSurveyUrl,
  "giants-inset-brace-the-ward": giantsInsetBraceTheWardUrl,
  "giants-inset-bone-pin": giantsInsetBonePinUrl,
  "giants-inset-contour-map": giantsInsetContourMapUrl,
  // eden-prime
  "eden-prime-bg": edenRealityUrl,
  "eden-prime-overlay": edenOverlayUrl,
  "eden-prime-cardfront": edenCardfrontUrl,
  "eden-inset-fruit-offered-too-quickly": edenInsetFruitOfferedTooQuicklyUrl,
  "eden-inset-first-warning-cry": edenInsetFirstWarningCryUrl,
  "eden-inset-curious-swarm": edenInsetCuriousSwarmUrl,
  "eden-inset-the-herd-misunderstands": edenInsetTheHerdMisunderstandsUrl,
  "eden-inset-flowers-face-the-wrong-sun": edenInsetFlowersFaceTheWrongSunUrl,
  "eden-inset-the-quiet-grove": edenInsetTheQuietGroveUrl,
  "eden-inset-paradise-runs": edenInsetParadiseRunsUrl,
  "eden-inset-take-the-fruit": edenInsetTakeTheFruitUrl,
  "eden-inset-gentle-approach": edenInsetGentleApproachUrl,
  "eden-inset-stillness-lesson": edenInsetStillnessLessonUrl,
  "eden-inset-follow-the-shade": edenInsetFollowTheShadeUrl,
  "eden-inset-hush-the-valley": edenInsetHushTheValleyUrl,
  "eden-inset-tread-softly": edenInsetTreadSoftlyUrl,
  // new-derelict
  "new-derelict-bg": derelictRealityUrl,
  "new-derelict-overlay": derelictOverlayUrl,
  "new-derelict-cardfront": derelictCardfrontUrl,
  "derelict-inset-bulkhead-7-c-seals": derelictInsetBulkheadUrl,
  "derelict-inset-unfinished-captains-address": derelictInsetAddressUrl,
  "derelict-inset-gravity-priority-shift": derelictInsetGravityUrl,
  "derelict-inset-administrative-misfile": derelictInsetMisfileUrl,
  "derelict-inset-corridor-becomes-lifeboat": derelictInsetLifeboatUrl,
  "derelict-inset-systems-panel": derelictInsetPanelUrl,
  "derelict-inset-the-order-arrives": derelictInsetOrderUrl,
  "derelict-inset-emergency-route": derelictInsetRouteUrl,
  "derelict-inset-override-badge": derelictInsetBadgeUrl,
  "derelict-inset-manual-release": derelictInsetReleaseUrl,
  "derelict-inset-follow-the-checklist": derelictInsetChecklistUrl,
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
  "whiteout-parking-garage": { key: "music-whiteout-parking-garage", url: whiteoutMusicUrl },
  "the-tidal-archive": { key: "music-the-tidal-archive", url: tidalMusicUrl },
  "the-ember-orchard": { key: "music-the-ember-orchard", url: orchardMusicUrl },
  "city-of-sleeping-giants": { key: "music-city-of-sleeping-giants", url: giantsMusicUrl },
  "eden-prime": { key: "music-eden-prime", url: edenPrimeMusicUrl },
  "new-derelict": { key: "music-eden-prime", url: edenPrimeMusicUrl },
};
