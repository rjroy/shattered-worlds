/**
 * Pure gating decision for the grief-support interstitial (REQ-W13-30..33).
 *
 * `questions`/`answers`/`the-beginning` deal with grief, death, and losing a
 * parent; the first time a player enters any of the three, WorldSelectScene
 * must show the support notice before Table rather than after. This is a
 * trilogy-level flag (one acknowledgment covers all three worlds), so the
 * decision is "is this world one of the three, and has the player not yet
 * seen the notice" — extracted here so it can be driven and asserted without
 * booting a Phaser scene, the same way `worldSelectPaging.ts` extracts the
 * carousel's paging logic.
 */
export const GRIEF_SUPPORT_WORLD_IDS: readonly string[] = [
  "questions",
  "answers",
  "the-beginning",
];

export function shouldShowGriefSupport(
  worldId: string,
  hasSeenGriefSupportNotice: boolean,
): boolean {
  return GRIEF_SUPPORT_WORLD_IDS.includes(worldId) && !hasSeenGriefSupportNotice;
}
