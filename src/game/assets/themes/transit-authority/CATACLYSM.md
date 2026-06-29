# The Transit Authority

## Cataclysm: The Service Suspension

The Transit Authority exists because every impossible place still needs a
platform number. Its stations connect old empires, future cities, drowned
moons, clockwork heavens, and neighborhoods that never belonged to the same
physics. Passengers arrive with luggage, visas, pets, relics, and weather from
other worlds.

The Walker's passage gives the network one destination it cannot route.

At first, the system responds like a bureaucracy. Tickets are checked twice.
Temporary credentials are reissued. Platform assignments blink, correct
themselves, and blink again. Then every departure board changes at once. Trains
that should leave for different realities all report the same obstruction:
ENTITY DETECTED.

The disaster is not delay. It is quarantine without an outside.

By the time the station staff understand the warning, the whole network has
begun protecting every realm from every other realm. Doors refuse passengers
whose journeys are already in progress. Trains arrive carrying people who never
boarded them. Platforms renumber themselves to avoid the Walker's path, but
every new number points closer to it.

## Deck-Builder Identity

**Threat verb: reroute.**

The Transit Authority attacks through enforced destination changes. Its hazards
move cards to the top of decks, return known problems, delay planned cards, and
convert useful movement into system alerts. The player survives by controlling
where the next card is going before the network assigns it somewhere worse.

The central question each turn is:

> Do I board the route the system offers, or spend Progress proving I am not
> the entity it is trying to contain?

This should feel different from ordinary discard or damage pressure. The
network is not destroying resources. It is reclassifying them, misrouting them,
and forcing the player to live with official decisions made one stop too late.

## Signature Rule: Reroute

Some Transit Authority hazards and rewards create or carry **Reroute**.

Reroute represents service changes, invalid transfers, platform closures, and
quarantine loops. When a Reroute trigger resolves, a card moves somewhere
specific but inconvenient: a world hazard returns to the top of the world deck,
a player card is placed on top of the player deck, a discard is revisited, or a
planned draw becomes a forced connection.

For an initial implementation, existing effects can express pieces of this
identity through `AddWorldCardToTop`, `AddPlayerCardToTop`,
`ReturnWorldCards`, `DiscardThenDraw`, `Draw`, and hazards that punish failing
to clear them before end of turn. A full version would add a "route" marker
that assigns a card to a future destination, then moves it when the next train,
draw, discard, or world reveal occurs.

## Three-Act Escalation

### Act I: Minor Delays

The station still believes this is a service disruption.

- Minor hazards close platforms, delay cards, or return one known threat.
- Clearing hazards grants tickets, transfers, or limited deck control.
- The player learns that movement is never neutral in the Transit Authority.

### Act II: Network Quarantine

Every line begins protecting itself from every other line.

- Cleared hazards recur as altered routes, replacement trains, or platform
  changes.
- Useful player cards are pinned to the top of the deck as credentials,
  transfers, and assigned departures.
- Rewards offer strong movement through the system, but each shortcut may
  trigger another quarantine response.

### Act III: All Lines Terminate Here

The network can no longer distinguish destination from containment.

- Reroute triggers chain, repeatedly returning known world hazards.
- The player's deck becomes a loop of official notices, missed transfers, and
  cards the system insists must be drawn next.
- The Walker arrives as every platform number changes to the same route, and
  the player must win before the Transit Authority makes the whole multiverse a
  closed station.

## Hazard Concepts

### Platform Reassignment

The departure board changes while passengers are already boarding. It moves a
useful player card or places a minor world hazard on top of the world deck. If
ignored, it repeats at end of turn.

### Ticket Invalidated

The player's temporary refugee credentials no longer match any authorized
route. It forces discard or delays a planned card until cleared.

### Train Arrives From Nowhere

An unscheduled train opens its doors with passengers from impossible stops. On
partial clear, return a world card from the discard pile to the top of the
world deck.

### Do Not Board Unknown Trains

A stationwide warning becomes a Slow hazard. While present, draw or discard
effects may trigger Reroute because the system treats motion as attempted
boarding.

### All Departures Suspended

Every board displays the same warning. It is difficult to clear and locks down
tempo. While present, returned hazards favor platform closures, invalid
tickets, and other route-control threats.

## Reward Card Concepts

### Temporary Credentials

Draw a card and gain a small defensive benefit, then place a card from hand on
top of the player deck. The system grants passage, but only on its schedule.

### Express Transfer

Deal modest Progress to a hazard. If it clears a Reroute card, prevent the
next forced return from the world discard this turn.

### Check the Board

Look at or reorder the top cards of a deck. Strong when the player needs to
know which route the system is about to enforce.

### Board Anyway

Gain immediate Progress or draw, then add a minor world hazard to the top of
the world deck. A risky shortcut that accepts a known future delay.

## Walker Interaction

The Walker does not break the Transit Authority. It gives the system a
passenger category it cannot process.

Before the Walker, the network could accept any contradiction as long as it had
a platform, fare class, and arrival time. After the player follows, every
route contains the same unfiled premise: something has moved between worlds
without boarding, paying, arriving, or departing. The Authority responds with
the only tool it trusts. It changes the route.

Mechanically, the Walker should arrive after the player has learned to use
forced movement as a tool rather than treating it as pure disruption. The
climax tests routing discipline: the player can still board, transfer, and
exploit the schedule, but every trip risks proving the network right to suspend
service everywhere.

## Visual Intrusion

The reality backdrop remains the enormous inter-reality terminal: glass roof,
iron arches, platform numbers, departure boards, mixed-era trains, portal
tunnels, realm signage, ticketed crowds, luggage, and station staff maintaining
routine order. The intrusion overlay should show the Service Suspension around
the perimeter:

- departure boards flipping simultaneously to SERVICE SUSPENDED, ENTITY
  DETECTED, and DO NOT BOARD in fragmented, partially unreadable text;
- red and violet warning bands crossing platform signs, clocks, and ticket
  barriers;
- trains from incompatible realities halted nose-to-nose or arriving through
  the wrong portals;
- quarantine gates, rope lines, stamped notices, and glowing platform seals
  spreading from the side tracks;
- route maps and rail lines bending into repeated Walker footprint geometry;
- passengers and staff caught mid-transfer, separated by glass, warning light,
  or impossible gaps between platforms.

Keep the central play area readable. The catastrophe should feel like the
world's most competent transit system discovering one traveler it cannot route
and suspending everywhere at once.
