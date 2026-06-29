# New Derelict

## Cataclysm: The Abandonment Drill

New Derelict is not a wreck when the player arrives. It is a working vessel
with shift schedules, supply crates, admin desks, crew mess traffic, and
officers too busy to ask why a stranger is standing on Deck 7.

The Walker's passage does not tear the ship open. It convinces the ship that
the disaster has already happened.

The first alarms are procedural. A bulkhead seals because a checklist says it
should. Gravity flickers because emergency allocation prefers the spine. The
captain begins an announcement and never reaches the verb. Crew members keep
following training for three terrible minutes, passing tablets, closing doors,
and redirecting traffic as if calm compliance can still save the vessel.

The disaster is not damage. It is protocol without context.

By the time anyone understands, the ship has become a derelict in advance of
its own ruin. Every corridor has a different emergency plan. Every plan assumes
the others have failed. The vessel is still intact, still pressurized, still
full of living people, but its systems have begun preserving a future wreck
instead of the present crew.

## Deck-Builder Identity

**Threat verb: isolate.**

New Derelict attacks by cutting planned routes into sealed compartments. Its
hazards restrict sequencing, strand useful cards, return problems to the top
of the world deck, or force the player to spend tempo reopening paths that were
safe a turn ago.

The central question each turn is:

> Do I spend Progress restoring access now, or use the emergency system before
> it locks me on the wrong side of my own plan?

This should feel different from ordinary attrition. The ship is not a monster
and its crew are not enemies. The pressure comes from automated safety logic
making individually reasonable decisions that combine into a survival maze.

## Signature Rule: Lockdown

Some New Derelict hazards and rewards create or carry **Lockdown**.

Lockdown represents sealed bulkheads, rerouted gravity, restricted access, and
conflicting emergency permissions. A card under Lockdown is not destroyed, but
it is delayed, pinned, or made awkward: placed on top of a deck, returned to the
world deck, made Slow, or unavailable until another hazard is cleared.

For an initial implementation, existing effects can express pieces of this
identity through `AddWorldCardToTop`, `AddPlayerCardToTop`,
`ReturnWorldCards`, `DiscardThenDraw`, `Draw`, and cards that punish failing to
clear hazards by end of turn. A full version would add a "sealed" marker that
attaches to a world hazard, player card, or deck position and prevents normal
movement until the player spends Progress or clears the linked emergency.

## Three-Act Escalation

### Act I: Routine Interruption

The crew still believes this is a drill or a contained incident.

- Minor hazards seal one route, reroute one card, or delay one useful action.
- Clearing hazards grants access, directions, or emergency tools.
- The player learns that the ship's helpful systems can become obstacles
  without becoming hostile.

### Act II: Conflicting Procedures

Every department follows a different emergency script.

- Cleared hazards return because another subsystem reclassifies the same
  corridor as unsafe.
- Useful player cards are pinned to the top of the deck or discarded as access
  credentials, tools, and orders move through bureaucracy.
- Rewards offer powerful tempo through emergency systems, but each shortcut may
  spread Lockdown elsewhere.

### Act III: Derelict Before Impact

The ship finishes rehearsing abandonment while people are still aboard.

- Lockdown triggers in clusters, sealing multiple routes and repeating known
  world threats.
- The world deck becomes a loop of corridors, alerts, and failed procedures the
  player has already survived once.
- The Walker arrives through a vessel that has not exploded, crashed, or lost
  atmosphere, but has already decided it cannot be saved.

## Hazard Concepts

### Bulkhead 7-C Seals

A routine corridor door closes with polite warning lights. It blocks tempo
until cleared. If left unresolved, place another world card on top of the deck
as traffic is redirected into a worse compartment.

### Unfinished Captain's Address

The announcement system begins the same sentence over and over. It adds Panic
or forces discard as crew and player alike wait for an order that never arrives.

### Gravity Priority Shift

The deck lurches as power is routed toward emergency zones. It disrupts hand
order, draw, or discard. On partial clear, pin a useful player card to the top
of the deck at the wrong time.

### Administrative Misfile

A clerk or terminal classifies the player as cargo, casualty, contractor, or
paperwork. Clearing this Hidden hazard grants deck control, but ignoring it
adds Lockdown because the ship accepts the wrong status as official.

### Corridor Becomes Lifeboat

A whole passage seals itself as an evacuation module no one can launch. It is
Slow and difficult to clear. While present, returned hazards favor sealed doors,
reroutes, and other access problems.

## Reward Card Concepts

### Override Badge

Deal modest Progress to a hazard. If it clears a Lockdown card, prevent the
next forced return from the world discard this turn.

### Emergency Route

Draw a card and gain immediate tempo, then place a minor world hazard on top of
the world deck. The shortcut works because some other corridor is being closed.

### Manual Release

Remove or delay the next Lockdown trigger. Weak when the board is open and
critical when several emergency systems are about to chain.

### Follow the Checklist

Put a card from hand or discard on top of the player deck, then gain a small
defensive benefit. It makes one future draw reliable at the cost of letting the
ship dictate sequence.

## Walker Interaction

The Walker does not wreck New Derelict. It gives the ship a future to obey.

Before the Walker, every system had a purpose: protect crew, maintain air,
route traffic, conserve power, preserve command. After the player follows, the
ship receives one impossible premise from the path ahead: abandonment has
already occurred. The vessel begins executing the procedures that would make
sense after catastrophe, and those procedures become the catastrophe.

Mechanically, the Walker should arrive after the player has learned to exploit
emergency access without surrendering control of the route. The climax tests
sequence and containment: the player can still use the ship's protocols, but
every override teaches another subsystem to seal the next door sooner.

## Visual Intrusion

The reality backdrop remains the busy starship commons: Deck 7 corridor
signage, engineering and crew-mess arrows, administration desks, systems
panels, supply crates, fluorescent ceiling strips, and crew moving through
ordinary work. The intrusion overlay should show the Abandonment Drill around
the perimeter by transforming that same corridor into its post-Walker emergency
state. It should preserve the central hallway opening while making the edges
look as though the ship's own systems have begun sealing the image:

- turn the existing ceiling light strips and wall seams into red emergency
  bars, warning strobes, and sealed bulkhead outlines;
- drop blast shutters and pressure doors from the side corridors, engineering
  sign, administration desk, and crew-mess openings;
- lift tools, mugs, tablets, paperwork, and small supply objects from the
  workstation edges where gravity has begun to flicker;
- corrupt systems panels, daily-assignment boards, and route signage into
  fractured announcement blocks and unreadable procedural warnings;
- replace ordinary arrows and corridor wayfinding with violet-white Walker
  geometry that points every route toward the same impossible evacuation path;
- isolate crew silhouettes from the original commons behind glass, pressure
  doors, warning light, or lockdown fields while keeping their calm workday
  posture.

Keep the central play area readable. The catastrophe should feel like a normal
workday being reorganized into a shipwide emergency faster than anyone can
object.
