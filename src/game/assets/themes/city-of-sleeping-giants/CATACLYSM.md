# The City of Sleeping Giants

## Cataclysm: The Remembering

The city was built on a mercy: the giants slept too deeply to notice what had
been founded across them.

The Walker's passage changes the scale of attention. It does not wake the
giants all at once. It gives their sleeping bodies one impossible stimulus to
remember. Every footprint lands like a nerve signal in creatures whose bones
are districts, whose veins are roads, whose old wounds have become harbors and
plazas.

At first the disaster looks survivable. A finger flexes. A bridge lifts by one
breath. Streets pulse with a slow current beneath their stones. Then the city
realizes the giants are not moving randomly. They are dreaming the Walker's
path back through themselves, and every neighborhood built on that path is
being recalled into the body that carried it.

The world is not being crushed. It is being noticed.

## Deck-Builder Identity

**Threat verb: stir.**

The City of Sleeping Giants attacks through accumulating disturbance. Its
hazards begin as manageable tremors, murmurs, and relocation orders, but each
unresolved problem adds to the body's awareness. The player survives by keeping
the city quiet long enough to act, choosing which districts can be allowed to
shift and which movements must be stopped immediately.

The central question each turn is:

> Do I spend Progress to calm the body beneath me, or exploit the movement
> before the giant finishes remembering that I am here?

This should feel different from ordinary damage pressure. The danger is not one
enemy attacking from outside. The battlefield itself is slowly becoming a
creature's reflex.

## Signature Rule: Stirring

At the end of each turn, the city gains a pulse of awareness.

World hazards can carry or create **Stir**. When enough Stir accumulates, the
oldest unresolved hazard is displaced, repeated, or transformed into a stronger
body-reflex hazard. Clearing certain hazards removes Stir, while exploiting
others may add Stir in exchange for immediate tempo.

For an initial implementation, existing effects can express pieces of this
identity through `AddWorldCardToTop`, `ReturnWorldCards`,
`AddPlayerCardToTop`, `DiscardThenDraw`, `Draw`, and effects that punish
discarding or failing to clear hazards. A full version would add a shared
"awareness" counter that advances at end of turn and triggers reflexes at
thresholds.

## Three-Act Escalation

### Act I: Civic Tremors

The city still treats the disturbance as ordinary geology.

- Minor hazards nudge cards between zones or add known threats back to the top
  of the world deck.
- Clearing hazards grants relocation, surveying, or bracing rewards.
- The player learns that every delay makes the ground more aware.

### Act II: Reflex Districts

The sleeping body begins responding without waking.

- Roads contract like veins, changing what the player can draw or keep.
- Cleared hazards return as neighboring districts shift into the same problem.
- Useful player cards may be pinned to the top of the deck at the wrong time,
  as if the city keeps putting tools back where it thinks they belong.

### Act III: The Body Remembers

Every giant shares the same dream of a footprint.

- Stir triggers in clusters, chaining multiple body-reflex hazards.
- The world deck repeatedly returns known threats, representing the same limb
  moving again from a different scale.
- The Walker arrives as the city's nervous system finishes tracing the route
  the player took across sleeping skin.

## Hazard Concepts

### Fingerquake Ward

A neighborhood built across one colossal hand tilts as the fingers flex. If
left unresolved, return this or another minor hazard to the top of the world
deck.

### Vein-Road Surge

The boulevard begins carrying a dark emerald current beneath its paving stones.
It forces discard or draw disruption as transit routes become circulation.

### Bone Anchor Failure

Skyscrapers bolted into exposed bone groan free of their foundations. It is
Slow and difficult to clear. On partial clear, add Stir or place a world card
on top of the deck.

### Surveyors Mark a Pulse

Scientific expedition teams identify the motion too late. Clearing this Hidden
hazard grants deck control, but ignoring it advances Stir because the city has
named the movement.

### The Giant Turns in Sleep

A massive reflex hazard. While present, returned hazards favor the largest or
most recently cleared threat, making the player relive the same movement at
greater scale.

## Reward Card Concepts

### Quiet Survey

Look ahead or reorder the top of a deck, then remove a small amount of Stir.
The player survives by understanding which body part is about to move.

### Brace the Ward

Deal modest Progress to a hazard. If it clears a body-reflex hazard, prevent
the next forced return from the world discard.

### Follow the Vein

Draw a card and gain immediate tempo, then add Stir. Useful when the player
needs speed more than silence.

### Bone Pin

Place a card from hand or discard on top of the player deck. It anchors a plan
in place, but may become dangerous when the giant's reflexes manipulate the
top card.

## Walker Interaction

The Walker does not awaken the giants. It makes the player legible to them.

Before the Walker, the city was too small to be interpreted. Its towers were
lichen. Its harbors were moisture. Its citizens were warmth moving over skin.
After the player follows, every footstep becomes a nerve pattern the giants can
feel through sleep. The bodies beneath the metropolis begin searching for the
source of that pattern, not with thought, but with reflex.

Mechanically, the Walker should arrive after the player has learned to manage
awareness rather than simply race damage. The climax tests restraint: the
player can spend the city's motion as power, but every useful movement teaches
the sleeping body where to find them.

## Visual Intrusion

The reality backdrop remains the violet-cyan metropolis of bone-white towers,
emerald terraces, canals, airships, and continent-sized figures hidden in
plain sight. The intrusion overlay should show the Remembering around the
perimeter:

- hairline cracks glowing violet along roads that follow veins;
- districts lifting as fingers, shoulders, and ribs shift beneath them;
- bone anchors pulling free from skyscrapers in white splintered arcs;
- emerald vascular light pulsing under canals, bridges, and plazas;
- expedition diagrams, contour marks, and anatomical labels bending toward a
  repeated footprint geometry;
- giant eyelids, knuckles, and stone-like skin details becoming subtly more
  awake without painting a fully risen titan.

Keep the central play area readable. The catastrophe should feel like a city
map being corrected by the body it was drawn on.
