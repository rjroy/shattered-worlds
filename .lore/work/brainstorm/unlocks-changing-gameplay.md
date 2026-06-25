---
title: Unlocks that change gameplay
date: 2026-06-17
status: open
tags: [unlocks, meta-progression, relics, gameplay-identity]
modules: [unlocks, destiny, card-system]
related: [.lore/work/brainstorm/unlock-system.md, .lore/work/brainstorm/shattered-worlds-meta-progression.md]
---

# Unlocks that change gameplay

The current unlock catalog mostly offers subtle power increases: more starting HP, more energy, more light, more heat, more brace, hand size growth, minimum resources, and keyword damage. These are useful, but they mostly say: "you are better at the same game."

The two current unlocks that go farthest toward changing how the game is played are:

- **Fortune**: at the start of each new act, choose 1 of 3 temporary boon cards for your hand.
- **Athlete's Instinct**: replace the default starter deck with the footballer starter deck.

These work because they change run texture. Fortune changes act transitions and creates a new draft moment. Athlete's Instinct changes the opening deck, which changes early priorities and weaknesses.

## Slay the Spire relic lessons

A strong Slay the Spire relic changes the player's valuation function. It makes cards, routes, risks, and turn sequencing mean something different. It usually does that with a rule, trigger, constraint, or conversion, rather than a larger number.

Useful lessons:

1. **Create new priorities**

   Relics like Kunai, Shuriken, Letter Opener, and Pen Nib make the player count attacks, skills, or turns differently.

   Shattered Worlds unlocks could reward sequencing:

   - Every third `Sprint` gains extra energy.
   - The first `Brace` each turn also gives light.
   - If you end a turn with no light, the next progress card is empowered.

2. **Convert one resource into another**

   Slay the Spire relics often turn health, gold, card removals, potions, or energy into different advantages. These feel transformative because they create build identity.

   Possible unlocks:

   - **Burn Bright**: heat can be spent as energy, but unused heat decays faster.
   - **Signal Fire**: gaining heat also reveals or restores a small amount of light.
   - **Overexertion**: start with less HP, but gain extra energy on the first two turns of each encounter.

3. **Add constraints with upside**

   Boss relics are memorable because the drawback makes the playstyle real: more energy, fewer potions; more power, less choice; stronger starts, narrower flexibility.

   Possible unlocks:

   - **Tunnel Vision**: draw +1 each turn, but card rewards offer 1 fewer choice.
   - **Heavy Pack**: start with a strong tool card, but the starter deck includes an extra `Panic`.
   - **Cold Discipline**: always have at least 1 heat, but healing is reduced.

4. **Make weak cards or awkward states desirable**

   Some relics make curses, exhaust, discard, or low HP matter. This is valuable for unlock design because it changes what the player drafts and tolerates.

   Possible unlocks:

   - **Fear Response**: the first time you play `Panic` each act, exhaust it and gain a major burst.
   - **Scavenger**: exhausted temporary boon cards have a chance to leave behind light, heat, or brace.
   - **Last Nerve**: while at low HP, defensive cards gain an added progress effect.

5. **Change the start of the run**

   Athlete's Instinct already demonstrates this. Slay the Spire's characters and starting relics show that opening identity matters enormously.

   More starter identity unlocks could be:

   - **Mechanic's Habit**: replace some movement cards with tool or repair cards.
   - **Scout's Rhythm**: smaller deck, less HP, more early draw.
   - **Survivor's Pack**: bigger, messier starter deck with more one-use safety cards.

6. **Alter reward structure**

   Fortune is promising because it changes act transitions. Slay the Spire relics often reshape what rewards matter: shops, rests, chests, elites, card rewards.

   Possible unlocks:

   - **Mapmaker**: after each act, choose between route intel, a card upgrade, or a temporary boon.
   - **Hoarder's Luck**: skip a card reward to gain a stronger future boon.
   - **Camp Ritual**: rest sites offer a unique third option, but ordinary healing is weaker.

## Design pattern

An unlock should ask the player a new question during the run.

Current examples:

- **Tough Hide** asks: "Can I survive slightly longer?"
- **Fortune** asks: "Which temporary tool changes this act?"
- **Athlete's Instinct** asks: "How does my opening deck reshape the whole run?"

Future unlocks should ask questions like:

- Do I draft around heat now?
- Is `Panic` secretly useful?
- Do I want a smaller deck or a messier one?
- Do I take a dangerous path because this unlock pays me for risk?
- Do I spend light defensively or convert it into tempo?

## Caution

Because these unlocks are meta-progression, the most transformative ones should act as sidegrades inside the destiny budget rather than permanent stacking power. The existing `DESTINY_BUDGET = 5` is a strong foundation for this. It allows unlocks to become stranger and more build-defining without every run becoming overloaded.
