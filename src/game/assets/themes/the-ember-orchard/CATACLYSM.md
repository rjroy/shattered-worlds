# The Ember Orchard

## Cataclysm: The Counterfall

The Ember Orchard survives by keeping a covenant with the sky: take one star,
leave one star, and the branches will keep feeding the constellations.

The Walker's passage breaks the direction of harvest. Stars no longer know
whether they are fruit, fuel, eggs, or heavens. The ripe ones do not drift
upward anymore. They fall down, tunneling into the soil like meteors with
roots. The harvested ones, the safe ones already stored in village lanterns,
hearths, engines, and warm cellars, begin to crack.

The disaster is not fire. It is birth in the wrong place.

Every stored star hatches into an ember thing: part moth, part seed, part
constellation map, bright enough to power a village and hungry enough to spend
that village as fuel. Every unpicked star hears the Walker below it and drops
toward the footprint. By the third night, the sky is going dark because the
constellations are being born on the ground.

## Deck-Builder Identity

**Threat verb: incubate.**

The Ember Orchard attacks tempo through delayed consequences. Its hazards look
useful or manageable at first: they may give light, reduce immediate pressure,
or reward the player for harvesting. Then they hatch, split, return, or convert
stored advantage into sudden threat.

The central question each turn is:

> Do I take the warmth now, knowing I may be carrying the egg that opens later?

This should feel different from ordinary damage pressure. The player is not
only clearing dangers; they are deciding which small suns are safe to bring
home.

## Signature Rule: Incubation

Some Orchard hazards and rewards create or mark **Dormant Stars**.

A Dormant Star is a delayed object that is harmless while carried, stored, or
left unresolved. When its timer expires, when the player draws too many cards,
or when enough Progress is spent in one turn, it hatches into a stronger world
hazard.

For an initial implementation, existing effects can express pieces of this
identity through `AddWorldCardToTop`, `AddPlayerCardToTop`,
`DiscardThenDraw`, `ReturnWorldCards`, `Draw`, and cards that punish discard or
partial clears. A full version would add a "hatch after N turns" marker or a
card state that transforms a dormant hazard into its awakened form.

## Three-Act Escalation

### Act I: Warm Harvest

The orchard still seems generous.

- Minor hazards offer useful light, draw, or Progress if handled carefully.
- Dormant threats are introduced as a delayed cost rather than an immediate
  punishment.
- The player learns that taking a star is never neutral.

### Act II: Cracked Lanterns

Village stores begin opening from the inside.

- Cleared hazards return in altered forms.
- Player draw and deck cycling accelerate hatching.
- Useful rewards may place future hazards on top of the world deck.

### Act III: Ground Constellation

The sky has almost emptied.

- Falling stars repeatedly add or recur world threats.
- Dormant cards hatch in clusters instead of one at a time.
- The Walker arrives through a field of footprints arranged like a new
  constellation, and the player must win before the orchard finishes planting
  the night underground.

## Hazard Concepts

### Cracked Hearth-Star

A village fuel-star pulses in its iron stove. It is easy to clear, but if left
alone it hatches into an ember moth hazard that deals damage and returns a
world card to the top of the deck.

### Falling Fruit

A lantern-sized star drops from the branches instead of rising. Clearing it
grants Progress, but discarding or ignoring it plants a Dormant Star.

### Rooted Meteor

A star has buried itself in the road and grown burning roots. It blocks tempo
until cleared. On partial clear, it adds another world card to the top of the
deck.

### The Orchard Counts Wrong

Every branch now bears one too many lights. While present, any extra draw or
discard effect also advances incubation.

### Hatchery Cellar

A Hidden storehouse full of harvested stars clicking against their shells.
Clearing it grants a powerful reward, but failing to clear it before the end of
turn awakens several smaller hazards.

## Reward Card Concepts

### Take One

Gain immediate Progress or draw, then place a Dormant Star on top of the world
deck. Strong tempo with a known future cost.

### Leave One

Cancel or delay the next hatch trigger. The card is weak when the board is
quiet and excellent when the Orchard is about to chain.

### Star-Pruner

Deal modest Progress to a hazard. If it clears a Dormant Star, exile it instead
of letting it hatch or return.

### Glasshouse Lantern

Draw a card and gain a small defensive benefit. At end of turn, if the player
drew above a threshold, add a minor world hazard.

## Walker Interaction

The Walker does not burn the Orchard. It gives every star a place to fall.

Before the Walker, the stars rose because the branches remembered the sky.
After the player follows, the branches remember the footprint instead. Every
falling star curves toward that absence. Every hatched ember thing carries a
tiny map of the same step inside its wings. Villagers still say "take one,
leave one," but the count is broken: the star you leave is the one that follows
you.

Mechanically, the Walker should arrive after the player has learned to profit
from delayed risk. The climax tests that greed and timing: the player can still
use the Orchard's warmth, but every borrowed light is now an egg close to
opening.

## Visual Intrusion

The reality backdrop remains the warm twilight orchard: orange fruit-stars,
village lanterns, naturalist ink linework, and crowded impossible botany. The
intrusion overlay should show the Counterfall around the perimeter:

- cracked lantern-stars opening like seed pods or eggs;
- ember-winged hatchlings emerging from stars in branches and storehouses;
- meteor-fruit falling downward into roads, baskets, and roots;
- violet-magenta trails bending toward repeated empty footprint geometry;
- broken constellation diagrams tangled in branches and furrows;
- warm orange harvest light invaded by impossible violet-white cores.

Keep the central play area readable. The catastrophe should feel like a harvest
festival realizing all its lanterns are alive.
