# Eden Prime

## Cataclysm: The First Alarm

Eden Prime has never needed the idea of danger. Its animals approach anything
new with open curiosity. Its plants grow fruit to be taken. Its insects land on
skin because contact has never meant capture, sting, or swat.

The Walker's passage gives paradise a second sun.

At first, nothing understands the signal. The birds fly toward the new light.
The great grazers lift their heads and wait for it to offer warmth. Flowers
turn both faces open. Then the shadows split in two directions, and every
creature receives the first contradiction its body has ever known: the world is
safe, and the world says run.

The disaster is not predation. It is the invention of prey.

By the second day, the ecosystem is practicing fear without knowing what it is
for. Herds stampede from harmless fruit. Trees drop entire harvests before they
are touched. Insects swarm every moving thing as if curiosity and panic were
the same instinct. Nothing hunts Eden Prime, but everything begins behaving as
though it has always been hunted.

## Deck-Builder Identity

**Threat verb: startle.**

Eden Prime attacks by turning harmless abundance into involuntary reaction. Its
hazards often begin as gentle, low-pressure opportunities: fruit to take,
creatures to pass, blossoms to clear, light to use. When startled, they become
tempo shocks that force discard, add Panic, return hazards, or waste the
player's planned sequence.

The central question each turn is:

> Do I take the gift in front of me, knowing paradise may learn to flinch from
> my hand?

This should feel different from ordinary enemy pressure. Eden Prime is not
trying to kill the player. The player is moving through a world whose first
defense mechanism is being written in real time, and every useful action risks
teaching that defense to spread.

## Signature Rule: Alarm

Some Eden Prime hazards and rewards create or carry **Alarm**.

Alarm represents the ecosystem misreading motion, light, and intent. When a
card with Alarm is drawn, discarded, partially cleared, or left unresolved at
end of turn, it can startle another card: adding Panic, forcing discard, moving
a hazard back to the top of the world deck, or changing a generous reward into
a future threat.

For an initial implementation, existing effects can express pieces of this
identity through `DiscardThenDraw`, `AddPlayerCardToTop`,
`AddWorldCardToTop`, `ReturnWorldCards`, `Draw`, and cards that punish discard
or failure to clear hazards. A full version would add an "alarm chain" marker
that spreads from one unresolved hazard to another whenever the player draws,
discards, or spends too much Progress in one turn.

## Three-Act Escalation

### Act I: Open Hands

Paradise still assumes everything is welcome.
You walk into a functioning starship.

Crew members are busy.

Someone mistakes you for administrative paperwork.

Nobody panics.

Someone gives directions without looking up from a tablet.

That makes the later shift much stronger.

Five minutes later:

Lights go red.
Bulkheads seal.
Gravity flickers.
The captain never finishes her announcement.
Every corridor becomes a survival scenario.

The contrast sells it.
- Minor hazards offer fruit, draw, or easy Progress before introducing Alarm.
- Animals and plants react incorrectly rather than aggressively.
- The player learns that receiving a gift may be enough to frighten the giver.

### Act II: The Flinch Spreads

The second sun teaches the ecosystem to rehearse escape.

- Cleared hazards return as startled herds, spore clouds, or swarms.
- Extra draw and discard begin spreading Alarm through the player's plan.
- Rewards remain powerful, but using too many in sequence makes the world
  interpret the player as a moving threat.

### Act III: Paradise Runs

Every living thing has learned a different version of fear.

- Alarm triggers in clusters, chaining harmless cards into disruptive hazards.
- The world deck repeats stampeded or swarming threats from the discard pile.
- The Walker arrives beneath two suns, and the player must win before Eden
  Prime completes its first lesson: every stranger is a predator.

## Hazard Concepts

### Fruit Offered Too Quickly

A branch bends low with heavy gold fruit, eager to be useful. Clearing it
grants Progress or draw, but taking the reward adds Alarm or places a startled
plant hazard on top of the world deck.

### Curious Swarm

Bright insects gather around the player without malice. They interfere with
timing: discard, draw disruption, or forced cycling. If startled, they return
as a larger cloud that adds Panic.

### The Herd Misunderstands

Great gentle grazers begin moving because one of them moved. It is Slow and
difficult to clear. On partial clear, return a world hazard to the top of the
deck as the stampede loops back through the valley.

### Flowers Face the Wrong Sun

Every blossom turns toward the second light. While present, extra draw or
high-Progress turns spread Alarm, because the plants read momentum as weather.

### First Warning Cry

A bird invents a sound no creature recognizes. It does no damage by itself, but
if ignored until end of turn it adds Panic or causes the oldest unresolved
hazard to startle.

## Reward Card Concepts

### Gentle Approach

Deal modest Progress to a hazard. If it clears a card with Alarm, prevent that
Alarm from spreading this turn.

### Take the Fruit

Draw cards or gain immediate Progress, then add Alarm to the next world card.
Strong tempo that teaches paradise to anticipate the player's reach.

### Stillness Lesson

Exhaust. Prevent the next discard or forced return caused by Alarm. Weak when
the board is calm and excellent when the ecosystem is about to chain.

### Follow the Shade

Look at or reorder the top of a deck, then place a card from hand on top of the
player deck. The player survives by moving slowly enough that the world can
predict them without panicking.

## Walker Interaction

The Walker does not bring a predator to Eden Prime. It brings the shape of
being followed.

Before the Walker, no animal had ever needed to decide whether a footstep
behind it mattered. No plant had ever rationed fruit. No bird had ever carried
a warning farther than a song. After the player follows, every living thing on
Eden Prime receives the same impossible lesson: something can come after you
without wanting food, territory, or shelter.

Mechanically, the Walker should arrive after the player has learned to profit
from Eden Prime's generosity while managing how much reaction that generosity
creates. The climax tests restraint and sequencing: the player can still accept
paradise's gifts, but every hurried choice teaches the garden to flee faster.

## Visual Intrusion

The reality backdrop remains the gentle green valley: terraced garden
structures grown into cliffs, clear water, flowering plants, offered fruit,
curious birds and insects, and long-necked grazers that do not know how to run.
The intrusion overlay should show the First Alarm around the perimeter:

- a second sun burning low at the edge of the sky, casting doubled shadows in
  conflicting directions;
- sauropod-like herds beginning to stampede while still looking confused rather
  than fierce;
- fruit splitting open early, dropping seeds and pulp as if the trees are
  surrendering their harvest;
- birds and insects forming startled spiral paths around the new light;
- flowers and vines turning away from the player and toward impossiblYou walk into a functioning starship.

Crew members are busy.

Someone mistakes you for administrative paperwork.

Nobody panics.

Someone gives directions without looking up from a tablet.

That makes the later shift much stronger.

Five minutes later:

Lights go red.
Bulkheads seal.
Gravity flickers.
The captain never finishes her announcement.
Every corridor becomes a survival scenario.

The contrast sells it.e
  violet-white glare;
- fine alarm geometry: repeated footprint shapes, tremor lines, and forked
  shadows spreading through leaves, water, and terrace walls.

Keep the central play area readable. The catastrophe should feel like a world
with no word for fear trying to invent one all at once.
