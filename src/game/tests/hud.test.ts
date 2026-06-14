import { describe, it, expect, afterEach } from "bun:test";
import { HUDView } from "../view/HUDView";
import type { GameState } from "../../core/index";
import { worldUsesLightManifest } from "../../data/worldUsesLightManifest";

// ---------------------------------------------------------------------------
// Fakes
//
// HUDView.update only mutates the text content of energyText, hpText, and
// actText by calling setText(). We fake these Text objects to
// capture the text that was set, so we can assert the correct value for a
// known state without needing a real Phaser runtime or canvas.
// ---------------------------------------------------------------------------

interface FakeText {
  text: string;
  visible: boolean;
  x: number;
  width: number;
  setText(content: string): void;
  setVisible(visible: boolean): void;
}

function makeFakeText(): FakeText {
  return {
    text: "",
    visible: true,
    x: 0,
    width: 0,
    setText(content: string): void {
      this.text = content;
    },
    setVisible(visible: boolean): void {
      this.visible = visible;
    },
  };
}

interface FakeDisplayObject {
  visible: boolean;
  setVisible(visible: boolean): void;
  setPosition(x: number, y: number): void;
  setSize(width: number, height: number): void;
}

function makeFakeDisplayObject(): FakeDisplayObject {
  return {
    visible: true,
    setVisible(visible: boolean): void {
      this.visible = visible;
    },
    setPosition(): void {},
    setSize(): void {},
  };
}

interface FakeHUDView {
  hpText: FakeText;
  actText: FakeText;
  energyText: FakeText;
  powerUpIndicators: [];
  powerUps: FakeDisplayObject;
  powerUpPanel: FakeDisplayObject;
  update: HUDView["update"];
}

function makeFakeHUDView(): {
  view: FakeHUDView;
  energyText: FakeText;
} {
  const energyText = makeFakeText();
  const view = Object.create(HUDView.prototype) as FakeHUDView;
  Object.assign(view, {
    hpText: makeFakeText(),
    actText: makeFakeText(),
    energyText,
    powerUpIndicators: [],
    powerUps: makeFakeDisplayObject(),
    powerUpPanel: makeFakeDisplayObject(),
  });
  return { view, energyText };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HUDView.update", () => {
  it("sets energyText to the current energy value", () => {
    const { view, energyText } = makeFakeHUDView();
    const state: GameState = {
      playerDraw: [],
      hand: [],
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      actIndex: 0,
      totalActs: 3,
      progress: {},
      hp: 20,
      energy: 5,
      light: 0,
      pendingForceDestroy: 0,
      braceCharges: 0,
      status: "playing",
      worldId: "test-world",
      rng: { a: 1, b: 2, c: 3, d: 4 },
      nextId: 1,
    };

    view.update(state);

    expect(energyText.text).toBe("5");
  });

  it("formats energy correctly with different values", () => {
    const { view, energyText } = makeFakeHUDView();
    const state: GameState = {
      playerDraw: [],
      hand: [],
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      actIndex: 0,
      totalActs: 3,
      progress: {},
      hp: 20,
      energy: 0,
      light: 0,
      pendingForceDestroy: 0,
      braceCharges: 0,
      status: "playing",
      worldId: "test-world",
      rng: { a: 1, b: 2, c: 3, d: 4 },
      nextId: 1,
    };

    view.update(state);
    expect(energyText.text).toBe("0");

    state.energy = 10;
    view.update(state);
    expect(energyText.text).toBe("10");
  });

  // -------------------------------------------------------------------------
  // Light indicator (Decision 3): visible for the whole run in a light-world,
  // absent in a non-light world, value tracks state.light. Driven entirely off
  // worldUsesLightManifest[worldId], never `light > 0`.
  // -------------------------------------------------------------------------

  // A power-up indicator records the icon texture key it was built with and the
  // value/visibility the HUD pushed onto it, so the Light tests can read both.
  interface FakePowerUp {
    texture: string;
    container: { visible: boolean; setVisible(v: boolean): void; x: number; setPosition(): void };
    countText: { text: string; width: number; setText(s: string): void };
  }

  function makeLightCapableView(): {
    view: FakeHUDView & { update: HUDView["update"] };
    powerUps: FakePowerUp[];
  } {
    const powerUps: FakePowerUp[] = [];
    // A scene stub whose add.* factories build the three objects addPowerUp
    // creates, recording the icon texture and exposing setText/setVisible.
    const scene = {
      add: {
        container: () => ({
          visible: true,
          x: 0,
          children: [] as unknown[],
          setVisible(v: boolean): void {
            this.visible = v;
          },
          setPosition(): void {},
          add(): void {},
        }),
        image: (_x: number, _y: number, texture: string) => ({
          texture,
          setDisplaySize() {
            return this;
          },
          setOrigin() {
            return this;
          },
        }),
        text: () => ({
          text: "",
          width: 10,
          setText(s: string): void {
            this.text = s;
          },
          setOrigin() {
            return this;
          },
        }),
      },
    };
    const view = Object.create(HUDView.prototype) as FakeHUDView;
    const indicators: FakePowerUp[] = [];
    Object.assign(view, {
      scene,
      hpText: makeFakeText(),
      actText: makeFakeText(),
      energyText: makeFakeText(),
      powerUpIndicators: indicators,
      powerUps: { add(): void {}, setVisible(): void {} },
      powerUpPanel: makeFakeDisplayObject(),
      // addPowerUp is the real method; it pulls from this.scene.add and pushes
      // onto powerUpIndicators. Capture each indicator into our records so the
      // test can read the icon texture and the value the HUD set.
      addPowerUp(texture: string): unknown {
        const icon = scene.add.image(0, 0, texture);
        const container = scene.add.container();
        const countText = scene.add.text();
        const indicator = { texture, container, countText } as unknown as FakePowerUp;
        void icon;
        indicators.push(indicator as never);
        powerUps.push(indicator);
        return indicator;
      },
      setPowerUpValue(indicator: FakePowerUp, value: number): void {
        indicator.container.setVisible(true);
        indicator.countText.setText(`${value}`);
      },
      powerUpWidth(): number {
        return 0;
      },
    });
    return { view: view as FakeHUDView & { update: HUDView["update"] }, powerUps };
  }

  function lightState(worldId: string, light: number): GameState {
    return {
      playerDraw: [],
      hand: [],
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      actIndex: 0,
      totalActs: 3,
      progress: {},
      hp: 20,
      energy: 5,
      light,
      pendingForceDestroy: 0,
      braceCharges: 0,
      status: "playing",
      worldId,
      rng: { a: 1, b: 2, c: 3, d: 4 },
      nextId: 1,
    };
  }

  const LIGHT_WORLD = "fog-test-light-world";
  afterEach(() => {
    delete worldUsesLightManifest[LIGHT_WORLD];
  });

  it("shows the Light indicator at Light 0 in a light-world (not gated on light > 0)", () => {
    worldUsesLightManifest[LIGHT_WORLD] = true;
    const { view, powerUps } = makeLightCapableView();

    view.update(lightState(LIGHT_WORLD, 0));

    const light = powerUps.find((p) => p.texture === "effect-icon-light");
    expect(light).toBeDefined();
    expect(light!.container.visible).toBe(true);
    expect(light!.countText.text).toBe("0");
  });

  it("tracks state.light as it changes", () => {
    worldUsesLightManifest[LIGHT_WORLD] = true;
    const { view, powerUps } = makeLightCapableView();

    view.update(lightState(LIGHT_WORLD, 2));
    let light = powerUps.find((p) => p.texture === "effect-icon-light");
    expect(light!.countText.text).toBe("2");

    view.update(lightState(LIGHT_WORLD, 5));
    light = powerUps.find((p) => p.texture === "effect-icon-light");
    expect(light!.countText.text).toBe("5");
  });

  it("omits the Light indicator entirely in a non-light world", () => {
    const { view, powerUps } = makeLightCapableView();

    // worldId not in the manifest → false → indicator never created.
    view.update(lightState("zombie-big-box", 0));

    expect(powerUps.some((p) => p.texture === "effect-icon-light")).toBe(false);
  });

  it("updates HP and act text alongside energy", () => {
    const { view } = makeFakeHUDView();
    const state: GameState = {
      playerDraw: [],
      hand: [],
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      actIndex: 1,
      totalActs: 3,
      progress: {},
      hp: 15,
      energy: 3,
      light: 0,
      pendingForceDestroy: 0,
      braceCharges: 0,
      status: "playing",
      worldId: "test-world",
      rng: { a: 1, b: 2, c: 3, d: 4 },
      nextId: 1,
    };

    view.update(state);

    expect(view.hpText.text).toBe("HP: 15");
    expect(view.actText.text).toBe("Act 2 / 3");
    expect(view.energyText.text).toBe("3");
  });
});
