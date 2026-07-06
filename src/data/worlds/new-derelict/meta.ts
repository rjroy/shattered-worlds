import type { WorldDisplayData, WorldHelpData } from "../types";

export const NEW_DERELICT_DISPLAY: WorldDisplayData = {
  name: "New Derelict",
  tagline: "A working ship rehearses its own abandonment.",
  story:
    "New Derelict is intact, pressurized, and crowded with living crew. After the Walker " +
    "passes, its safety systems decide the disaster has already happened and seal the ship " +
    "around everyone still working inside.",
  difficulty: 4,
  cycle: 4,
  backgroundKey: "new-derelict-bg",
};

export const NEW_DERELICT_HELP: WorldHelpData = {
  mechanics: [
    {
      title: "Lockdown seals routes",
      detail: "Hazards apply Lockdown to cards in hand. Lockdown does not fade on its own.",
    },
    {
      title: "Seals compound",
      detail:
        "A sealed hazard costs one more Progress to clear for every other sealed card in hand.",
    },
    {
      title: "Reopen access deliberately",
      detail:
        "Clear the sealed card, clear a linked emergency, or use Override Badge and Manual Release.",
    },
    {
      title: "Shortcuts spread the maze",
      detail: "Emergency Route gives tempo now but seals the next world card you draw.",
    },
  ],
};
