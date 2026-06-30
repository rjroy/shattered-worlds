import type { Card, CardId, GameState } from "../model/types";

export type PreviewEventSummary = readonly string[] | null;

export const EMPTY_PREVIEW_LINES: readonly string[] = [];

export type PreviewFormatContext = {
  readonly before: GameState;
  readonly after: GameState;
  readonly beforeCards: ReadonlyMap<CardId, Card>;
  readonly afterCards: ReadonlyMap<CardId, Card>;
  readonly cardName: (id: CardId, templateId: string) => string;
  readonly namesFromIds: (
    ids: readonly CardId[],
    templateIds: readonly string[],
  ) => readonly string[];
  readonly destLabel: (dest: string) => string;
  readonly plural: (word: string, count: number) => string;
  readonly listNames: (names: readonly string[]) => string;
};
