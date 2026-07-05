import type { GameEvent } from "../contract";

export function logEvent(event: GameEvent): void {
  let baseString = `event: ${event.type}`;
  if (event.sourceKind || event.sourceCardId) baseString += ` source:`;
  if (event.sourceKind) baseString += ` ${event.sourceKind}`;
  if (event.sourceCardId) baseString += ` ${event.sourceCardId}`;

  switch (event.type) {
    case "CardPlayed":
      console.log(
        `${baseString} id: ${event.cardId} template: ${event.templateId} ordinal: ${event.templateOrdinalThisTurn}`,
      );
      break;
    case "HazardDiscarded":
      console.log(`${baseString} id: ${event.cardId} template: ${event.templateId}`);
      break;
    case "HazardResolved":
    case "HazardPartial":
      console.log(`${baseString} id: ${event.hazardId} template: ${event.templateId}`);
      break;
    case "ProgressDealt":
      console.log(
        `${baseString} id: ${event.hazardId} template: ${event.templateId} amount: ${event.amount} total: ${event.hazardTurnTotal}`,
      );
      break;
    case "DamageDealt":
    case "HealReceived":
      console.log(`${baseString} amount: ${event.amount}`);
      break;
    case "CardGained":
      console.log(
        `${baseString} id: ${event.id} template: ${event.templateId} dest: ${event.dest} rarity: ${event.rarity}${event.setName ? ` set: ${event.setName}` : ""}`,
      );
      break;
    case "PendingCardDestroy":
      console.log(`${baseString} count: ${event.count}`);
      break;
    case "CardDestroyed":
    case "WorldCardsReturned":
    case "CardsFrozen":
    case "CardsThawed":
    case "CardsBurnedForHeat":
    case "WorldCardsExiled":
      console.log(
        `${baseString} ids: ${event.ids.join(", ")} templates: ${event.templateIds.join(", ")}`,
      );
      break;
    case "CardsDiscarded":
      console.log(
        `${baseString} ids: ${event.cardIds.join(", ")} templates: ${event.templateIds.join(", ")}`,
      );
      break;
    case "HpChanged":
      console.log(`${baseString} hp: ${event.hp}`);
      break;
    case "EnergyChanged":
      console.log(`${baseString} energy: ${event.energy}`);
      break;
    case "LightChanged":
      console.log(`${baseString} light: ${event.light}`);
      break;
    case "HeatChanged":
      console.log(`${baseString} heat: ${event.heat} delta: ${event.delta}`);
      break;
    case "DeckShuffled":
    case "TurnEnded":
    case "WorldWon":
      console.log(baseString);
      break;
    case "ActAdvanced":
      console.log(`${baseString} act: ${event.act}`);
      break;
    case "BoonOffered":
      console.log(
        `${baseString} source: ${event.source} set: ${event.setName} templates: ${event.templateIds.join(", ")} rarities: ${event.rarities.join(", ")}`,
      );
      break;
    case "BoonCardGranted":
      console.log(
        `${baseString} id: ${event.cardId} template: ${event.templateId} dest: ${event.dest} rarity: ${event.rarity}`,
      );
      break;
    case "CardsDrawn":
      console.log(
        `${baseString} ids: ${event.ids.join(", ")} templates: ${event.templateIds.join(", ")} hazard: ${event.bHazard}`,
      );
      break;
    case "WorldLost":
      console.log(`${baseString}${event.cause ? ` cause: ${event.cause}` : ""}`);
      break;
    case "BraceChanged":
      console.log(`${baseString} braceCharges: ${event.braceCharges}`);
      break;
    case "BraceConsumed":
    case "KeywordGuardConsumed":
      console.log(`${baseString} absorbed: ${event.absorbed} remaining: ${event.remaining}`);
      break;
    case "KeywordApplied":
      console.log(
        `${baseString} ids: ${event.ids.join(", ")} templates: ${event.templateIds.join(", ")} keyword: ${event.keyword} value: ${event.value}`,
      );
      break;
    case "KeywordReduced":
    case "KeywordRemoved":
      console.log(
        `${baseString} ids: ${event.ids.join(", ")} templates: ${event.templateIds.join(", ")} keyword: ${event.keyword}`,
      );
      break;
    case "keywordGuardChanged":
      console.log(`${baseString} keywordGuard: ${event.keywordGuard}`);
      break;
    case "HazardAdded":
      console.log(`${baseString} id: ${event.id} template: ${event.templateId}`);
      break;
    case "PlayerDiscardRecalled":
      console.log(
        `${baseString} ids: ${event.cardIds.join(", ")} templates: ${event.templateIds.join(", ")} source: ${event.source} dest: ${event.dest}`,
      );
      break;
    default: {
      // Exhaustiveness guard: if `GameEvent` gains a variant with no case
      // above, `event` no longer narrows to `never` here and `bun run
      // typecheck` fails at compile time — the KeywordReduced bug (a case
      // silently missing until a live playtest crash) reached this default
      // branch at runtime instead, because the old cast (`as unknown as
      // GameEvent`) hid the gap from the compiler.
      const exhaustiveCheck: never = event;
      throw new Error(`logEvent: unhandled event type ${(exhaustiveCheck as GameEvent).type}`);
    }
  }
}
