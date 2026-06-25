---
title: Audio Volume Settings
date: 2026-06-25
status: current
tags: [audio, settings, music, fx, volume, phaser]
fg-type: architecture
fg-sources: [.lore/work/plans/sound-volume-settings.md]
fg-status: current
---

# Audio Volume Settings

Audio settings add separate Music and FX sliders plus a master mute. Sliders are continuous 0-100% controls that scale existing per-sound base volumes. Music defaults to 100%, FX defaults to 50%, and master mute silences both.

Phaser exposes one global sound volume, not separate music and FX buses, so channel control is implemented per sound. Effective volume is `baseVolume * channelGain`, where mute forces the gain to zero.

## Settings Model

`UserSettings` uses a payload version bump while keeping the existing storage key stable. Version 1 settings migrate forward by preserving existing preview preferences and filling audio defaults. Version 2 loads clamp volume values into the valid range.

## Runtime Wiring

Menu and world music read music gain at start. Scenes that host the settings overlay also reapply music volume live when sliders or mute change. One-shot FX read current FX gain at play time. Looped card FX receives an FX gain accessor so it can scale its base sound when started.

Destiny and Chronicle do not host the settings overlay, but they receive the settings store so menu music starts at the current saved gain when entering those scenes.
