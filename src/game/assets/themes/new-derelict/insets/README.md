# New Derelict Inset Art Guidance

Thumbnail-first square inset assets (11). Filename = `inset-<kebab-name>.webp`;
asset key = `derelict-inset-<kebab-name>`.

## Direction

Full-bleed bold graphic-novel comic illustration with heavy black ink,
dramatic chiaroscuro, a strong rim-lit single subject, and rich saturated
lighting. Use white-steel, teal, and systems cyan with emergency red-amber;
reserve sparse violet-white geometry for Lockdown. The signature verb is
**isolate**: hazards show access sealing in progress, while rewards show access
being restored or knowingly spread.

Each image has one large foreground subject, a bold silhouette readable at
100x100, and a simplified darker starship background with one or two cues. No
frame, title, readable UI copy, logo, watermark, Walker, Door, explosion,
combat scene, crowd, or tiny console clutter.

## Files and per-card intent

- `inset-bulkhead-7-c-seals.webp` -> `derelict-inset-bulkhead-7-c-seals`: a pressure bulkhead visibly closing.
- `inset-unfinished-captains-address.webp` -> `derelict-inset-unfinished-captains-address`: a captain at a microphone as the signal cuts off.
- `inset-gravity-priority-shift.webp` -> `derelict-inset-gravity-priority-shift`: workstation objects lifting in a gravity flicker.
- `inset-administrative-misfile.webp` -> `derelict-inset-administrative-misfile`: one status tablet marked by an abstract red error seal.
- `inset-corridor-becomes-lifeboat.webp` -> `derelict-inset-corridor-becomes-lifeboat`: corridor walls folding into a lifeboat hatch.
- `inset-systems-panel.webp` -> `derelict-inset-systems-panel`: one cyan override control on a large emergency panel.
- `inset-the-order-arrives.webp` -> `derelict-inset-the-order-arrives`: a command terminal emitting an overwhelming red evacuation pulse.
- `inset-emergency-route.webp` -> `derelict-inset-emergency-route`: a hand choosing a cyan shortcut while a red door closes behind.
- `inset-override-badge.webp` -> `derelict-inset-override-badge`: a single badge presented to a sealed pressure door.
- `inset-manual-release.webp` -> `derelict-inset-manual-release`: a large mechanical release lever being pulled.
- `inset-follow-the-checklist.webp` -> `derelict-inset-follow-the-checklist`: a gloved hand following a physical checklist beside an orderly route map.

## Prompt template

```text
Full-bleed square illustration, bold graphic-novel comic art with heavy black
ink linework and dramatic chiaroscuro, painted in rich saturated light. One
large [SUBJECT] instantly recognizable in silhouette at thumbnail size,
rim-lit against a simplified dark working-starship background with only
[ONE OR TWO CUES]. White-steel, teal, and systems cyan palette with emergency
red-amber and one sparse violet-white geometric Lockdown accent. No border,
frame, card layout, title, readable text, logo, watermark, Walker, Door,
explosion, combat, crowd, or tiny clutter.
```

## Finishing pass and validation

Generated sources are fit to 600x600, then processed at contrast `1.12`,
brightness `0.99`, and unsharp mask radius `1.1` / percent `80` / threshold `4`.
All eleven final WebPs were reviewed together on a 100x100 contact sheet for
silhouette, subject distinction, palette consistency, and thumbnail
readability before asset binding.
