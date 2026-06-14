import type { WorldDisplayData, WorldHelpData } from '../types'

export const FOG_BEACH_PARTY_DISPLAY: WorldDisplayData = {
  name: "Fog Beach Party",
  tagline: "Golden hour on the sand. Then the fog rolls in, and there is something in it.",
  story:
    "The bonfires were lit, the music was good, and the light held warm and low over the water. Then the fog came off the sea faster than fog should, cold and total, swallowing the party string by string. The shapes moving through it are still close. You just can't see which ones mean to hurt you.",
  backgroundKey: "fog-beach-party-bg",
}

export const FOG_BEACH_PARTY_HELP: WorldHelpData = {
  mechanics: [
    {
      title: "Light fades every turn",
      detail:
        "You start with some Light and lose 1 at the start of each turn. A card is visible only while your Light is at least its Concealed depth, so the deep fog closes back in unless you keep relighting it.",
    },
    {
      title: "Concealed cards hide and still bite",
      detail:
        "A concealed card shows only its fog depth. Its name, cost, and effect are hidden, and you cannot aim single-target progress at it, but its end-of-turn tick still hits you. Raise Light above its depth to reveal and target it.",
    },
    {
      title: "Blind-discard to flee",
      detail:
        "You can always discard a concealed hazard even though you cannot target it. Fleeing blind gambles on its discard reaction, but it is the valve when you are out of Light.",
    },
    {
      title: "Light the fog with the kit",
      detail:
        "Clear a Bonfire to earn the light kit: Flashlight (steady top-up), Flare Gun (one-shot flood, then exhausts), the Bonfire card (sustained refuel), and Searchlight, which sweeps every shape in hand, concealed or not.",
    },
    {
      title: "Snipe, sweep, or see",
      detail:
        "Explore snipes one lit shape hard. Searchlight sweeps the whole hand blind and spread thin. Raising Light reveals everything so you can aim. Light is rarely required, but it is almost always the better line.",
    },
    {
      title: "The deep end scales with fog",
      detail:
        "Whiteout sits in the deepest fog and deals 1 damage for every concealed card in your hand, itself included. Carrying a fistful of fog into a Whiteout turn is how the party ends.",
    },
  ],
}
