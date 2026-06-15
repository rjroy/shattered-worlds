# The Tidal Archive

## Cataclysm: The Unmooring

The people of the Archive do not remember events. They remember where events
happened.

The Walker's passage breaks the bond between memory and place. Buildings drift
away from their histories, streets arrive at destinations they never connected
to, and whole districts inherit the memories of drowned civilizations. As the
tides worsen, every location begins converging on the same remembered event:
the moment the player followed the Walker.

The world is not being drowned. It is being shuffled.

## Deck-Builder Identity

**Threat verb: displace.**

The Tidal Archive attacks card position rather than health alone. Its hazards
move cards between the hand, draw pile, discard pile, and the top of either
deck. The player survives by remembering where useful cards went and by
controlling what surfaces next.

The central question each turn is:

> Do I spend Progress on the hazard in front of me, or preserve enough deck
> control to survive what the tide is about to return?

This should feel different from ordinary discard pressure. A discarded card is
not gone; it has become a place the tide can revisit.

## Signature Rule: Tidal Memory

At the end of each turn, the Archive recalls a location.

One card from the player's discard pile is returned to the top of the player
deck. World hazards influence which card returns, turning the discard pile into
a dangerous second hand whose order matters.

For an initial implementation, existing effects can express pieces of this
identity through `DiscardThenDraw`, `AddPlayerCardToTop`,
`AddWorldCardToTop`, `ReturnWorldCards`, and `Draw`. A full version would add a
targeted "choose a card from discard and place it on top" effect so the player
can deliberately navigate remembered locations.

## Three-Act Escalation

### Act I: Misfiled Shores

The tide begins moving individual memories.

- Minor hazards cycle or return cards.
- Clearing hazards grants simple scry-like rewards: discard, draw, or recover.
- The player learns that card zones are locations in this world.

### Act II: Borrowed Histories

Locations inherit events that happened elsewhere.

- Hazards copy or recur from the world discard.
- Useful player cards are stranded on top at the wrong time.
- Clearing one hazard may return another, making sequence matter more than raw
  Progress.

### Act III: The Convergence

All routes begin leading to the Walker.

- The world deck repeatedly places known threats on top.
- The player's discard is aggressively returned, including junk and Panic.
- The Walker arrives amid a tightly controlled loop: the player must build one
  decisive burst while the Archive keeps replaying the path that led here.

## Hazard Concepts

### Wandering Stacks

Bookshelves detach from their district and carry a remembered card with them.
If left unresolved, return a player discard to the top of the player deck.

### Misfiled Century

A district remembers the wrong disaster. On end of turn, place a recurring
hazard on top of the world deck.

### Bridge to Yesterday

The coral road folds backward. Clearing it returns another world card to the
deck; discarding it costs health. The player chooses which problem to repeat.

### Drowned Index

A Hidden archive containing the location of a useful memory. Clearing it grants
a card-selection or draw-control reward.

### The Same Footprint

Every map now points to one of the Walker's steps. It is Slow and difficult to
clear. While present, returned cards favor junk, Panic, or other low-value
memories.

## Reward Card Concepts

### Mark the Shelf

Put a chosen card from the discard pile on top of the player deck.

### Cross-Reference

Discard a card, draw two cards. Strong when the player knows the discarded card
can be recalled later.

### Waterproof Notes

Deal modest Progress, then return a world card to the deck. A tempo tool that
trades today's safety for a known future problem.

### Anchor the Memory

Exhaust. Choose a card in hand to protect from forced discard or displacement
this turn, then draw a card.

## Walker Interaction

The Walker does not command the sea. Its presence gives the Archive one
location that exists in every possible history.

Each footprint becomes a permanent memory. Anyone who visits one remembers
following the Walker, whether they did or not. By the final act, all maps,
bridges, currents, and deck cycles lead back to those footprints.

Mechanically, the Walker should arrive after the player has learned to engineer
the top of the deck. The climax tests that lesson: assemble a burst by placing
the right sequence of cards where the tide must return them.

## Visual Intrusion

The reality backdrop remains the turquoise-and-gold floating archive. The
intrusion overlay should show the Unmooring around the perimeter:

- broken coral bridges curling into impossible loops;
- translucent displaced buildings overlapping the present campus;
- chained books rising in spirals from the water;
- map lines, index marks, and inked routes all bending toward one footprint;
- sea-glass green and coral red giving way to the Walker's impossible violet.

Keep the central play area readable. The catastrophe should look like the page
itself has been shuffled and incorrectly reassembled.
