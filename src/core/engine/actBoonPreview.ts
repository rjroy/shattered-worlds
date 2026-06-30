import type { GameEvent } from "../model/types";
import type { PreviewEventSummary, PreviewFormatContext } from "../view/previewFormat";

export function previewBoonOfferedEvent(
  event: GameEvent,
  _context: PreviewFormatContext,
): PreviewEventSummary {
  if (event.type !== "BoonOffered") return null;
  return [`Boon offered from ${event.setName}`];
}
