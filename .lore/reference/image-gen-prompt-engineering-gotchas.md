---
title: Image-Gen Prompt Engineering Gotchas
date: 2026-07-02
status: current
tags: [art-gen, image-generation, flux-2-pro, prompt-engineering, content-moderation, inset-authoring]
fg-type: lesson
fg-sources: [.lore/work/notes/transit-authority.md]
fg-status: current
fg-evidence:
  code:
    - src/game/assets/themes/transit-authority/insets/README.md
---

# Image-Gen Prompt Engineering Gotchas

Two reusable findings surfaced while generating Transit Authority's card inset art via `art-gen:generate-image` (backed by `flux-2-pro`).

## Describing an object as text-bearing causes hallucinated text

Prompting for anything described as a text-bearing object — a "board," a "ticket," a "stamp" — reliably causes `flux-2-pro` to hallucinate legible (and sometimes CJK) glyphs baked into the image, even when no text was requested. This bit Transit Authority twice: the `transit-authority-reality.webp` backdrop baked in a legible departure-board/title-banner/station-signage, and separately the `intrusion-overlay.webp` baked in fully legible strings like "SERVICE SUSPENDED" and "PLATFORM 7" — both had to be regenerated in place after review caught the violation of the shared no-baked-text art-direction contract. The fix is describing the same object in purely geometric/abstract terms instead ("a flipping split-flap panel," not "a departure board with route text") — this avoids triggering the hallucination while still reading as the intended object.

## Content moderation blocks human figures near confinement framing

Attempts to include human figures depicted as trapped or confined (e.g., "passengers behind glass/barriers," a required visual beat from the Transit Authority spec) were blocked by content moderation on every attempt. The accepted workaround was a softer nod — seated figures visible behind train windows, without confinement/barrier framing — judged non-blocking by independent review even though it didn't fully satisfy the original checklist beat. When a spec calls for imagery combining human figures with confinement/restraint framing, budget for this to be a real generation constraint, not just a prompting problem to iterate through.
