import Phaser from "phaser";
import { textStyle, TEXT } from "./presentation";
import { CANVAS_W, CANVAS_H } from "./layout";
import { addScreenBackdrop } from "./screenBackdrop";
import type { ConfirmationMode, UserSettings, UserSettingsStore } from "../runtime/userSettings";
import { VolumeSlider } from "./VolumeSlider";

// ---------------------------------------------------------------------------
// Control option tables. These drive both rendering and the click handlers, so
// the option set lives in one place rather than being duplicated per button.
// ---------------------------------------------------------------------------

interface ConfirmationOption {
  readonly value: ConfirmationMode;
  readonly label: string;
}

const CONFIRMATION_OPTIONS: readonly ConfirmationOption[] = [
  { value: "always", label: "Always" },
  { value: "risk-only", label: "Risk only" },
  { value: "off", label: "Off" },
];

interface ToggleOption {
  readonly value: boolean;
  readonly label: string;
}

const HOVER_OPTIONS: readonly ToggleOption[] = [
  { value: true, label: "On" },
  { value: false, label: "Off" },
];

// Master mute toggle — same segmented pattern as hover but for muting all audio.
const MUTE_OPTIONS: readonly ToggleOption[] = [
  { value: true, label: "Mute All" },
  { value: false, label: "No Mute" },
];

// Selected vs. unselected segment styling, shared by both segmented controls.
const SEGMENT_W = 110;
const SEGMENT_H = 30;
const SEGMENT_GAP = 8;
const SELECTED_FILL = 0x1d314f;
const SELECTED_STROKE = 0x88ccff;
const UNSELECTED_FILL = 0x0b101a;
const UNSELECTED_STROKE = 0x31415d;

/**
 * A single segmented-control button paired with the value it selects. The view
 * stores these so re-rendering the highlight is a cheap fill/stroke swap rather
 * than a rebuild.
 */
interface Segment<T> {
  readonly value: T;
  readonly bg: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
}

/**
 * Full-screen settings overlay, hidden by default. Edits the injected
 * UserSettingsStore in place; it never dispatches, restarts, or clears the run.
 *
 * The store is taken by dependency injection so the view has no knowledge of the
 * runtime or any global state. Opening re-syncs the control highlights from the
 * store via open(); the click handlers (selectConfirmationMode /
 * setDetailedHoverPreviews / setMusicVolume / setFxVolume / setMasterMute) are
 * public so tests can drive them without simulating Phaser pointer events.
 */
export class SettingsOverlayView extends Phaser.GameObjects.Container {
  // Assigned in build(), which the constructor calls. build() is a separate
  // method (not inline in the constructor) so view tests can drive it against
  // an Object.create'd instance without invoking the heavy Phaser Container
  // constructor — an ES6 class constructor cannot be re-applied with .call().
  private settings!: UserSettingsStore;
  private readonly confirmationSegments: Segment<ConfirmationMode>[] = [];
  private readonly hoverSegments: Segment<boolean>[] = [];
  private readonly muteSegments: Segment<boolean>[] = [];
  private musicSlider!: VolumeSlider;
  private fxSlider!: VolumeSlider;
  /** Live-reapply hook called by volume/mute handlers (wired by step 6). */
  private onAudioChange: (() => void) | undefined;

  constructor(scene: Phaser.Scene, settings: UserSettingsStore, onAudioChange?: () => void) {
    super(scene, CANVAS_W / 2, CANVAS_H / 2);
    scene.add.existing(this);
    this.setDepth(1000);
    this.setVisible(false);
    this.onAudioChange = onAudioChange;
    this.build(scene, settings);
  }

  /** Build the panel + controls. Split out for testability (see field note). */
  private build(scene: Phaser.Scene, settings: UserSettingsStore): void {
    this.settings = settings;

    // Veil + an interactive blocking rectangle so clicks never fall through to
    // the table underneath (mirrors HelpOverlayView).
    const backdrop = addScreenBackdrop(scene, {
      key: "screen-destiny",
      veilColor: 0x080a12,
      veilAlpha: 0.86,
      tint: 0xb8d5ff,
    });
    backdrop.setPosition(0, 0);
    this.add(backdrop);

    const blocker = scene.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x080a12, 0.26);
    blocker.setInteractive();
    this.add(blocker);

    // Titled panel — grown to 600px height for volume + mute rows.
    const panel = scene.add.rectangle(0, 0, 560, 560, 0x101725, 0.92);
    panel.setStrokeStyle(1, 0x31415d, 0.85);
    panel.setRounded(8);
    this.add(panel);

    this.addText(-260, -265, "SETTINGS", {
      fontSize: "20px",
      color: TEXT.textLight,
      fontStyle: "bold",
    });

    this.buildConfirmationControl(-260, -205);
    this.buildHoverControl(-260, -95);
    this.buildMusicSlider(-260, 25);
    this.buildFxSlider(-260, 65);
    this.buildMuteControl(-260, 100);
    this.buildCloseButton();

    // Reflect persisted state on construction so the overlay is correct even if
    // it is shown without a subsequent open() call.
    this.refreshFromStore();
  }

  // -------------------------------------------------------------------------
  // Open / close
  //
  // open() is the canonical entry point: it re-syncs the highlights from the
  // store before showing, so the overlay always reflects the current persisted
  // state. close() only toggles visibility — it never touches game state.
  // -------------------------------------------------------------------------

  open(): void {
    this.refreshFromStore();
    this.setVisible(true);
  }

  close(): void {
    this.setVisible(false);
  }

  // -------------------------------------------------------------------------
  // Click handlers (public so tests can drive them directly)
  // -------------------------------------------------------------------------

  /** Persist a new confirmation mode and re-render the highlight. */
  selectConfirmationMode(mode: ConfirmationMode): void {
    this.settings.update({ confirmationMode: mode });
    this.refreshFromStore();
  }

  /** Persist the detailed-hover toggle and re-render the highlight. */
  setDetailedHoverPreviews(enabled: boolean): void {
    this.settings.update({ detailedHoverPreviews: enabled });
    this.refreshFromStore();
  }

  /** Persist music volume and re-apply to live music. */
  setMusicVolume(value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.settings.update({ musicVolume: clamped });
    this.refreshFromStore();
    this.onAudioChange?.();
  }

  /** Persist FX volume and re-apply. */
  setFxVolume(value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.settings.update({ fxVolume: clamped });
    this.refreshFromStore();
    this.onAudioChange?.();
  }

  /** Persist master mute toggle and re-apply. */
  setMasterMute(muted: boolean): void {
    this.settings.update({ masterMute: muted });
    this.refreshFromStore();
    this.onAudioChange?.();
  }

  // -------------------------------------------------------------------------
  // Construction helpers
  // -------------------------------------------------------------------------

  private buildConfirmationControl(x: number, y: number): void {
    this.addText(x, y, "Confirmation", {
      fontSize: "14px",
      color: TEXT.textKeyword,
      fontStyle: "bold",
    });

    CONFIRMATION_OPTIONS.forEach((opt, i) => {
      const segX = x + 6 + i * (SEGMENT_W + SEGMENT_GAP) + SEGMENT_W / 2;
      const segment = this.addSegment(segX, y + 44, opt.value, opt.label, () =>
        this.selectConfirmationMode(opt.value),
      );
      this.confirmationSegments.push(segment);
    });

    this.addText(x, y + 70, "Confirm before committing actions.", {
      fontSize: "12px",
      color: TEXT.textMuted,
    });
  }

  private buildHoverControl(x: number, y: number): void {
    this.addText(x, y, "Detailed hover previews", {
      fontSize: "14px",
      color: TEXT.textKeyword,
      fontStyle: "bold",
    });

    HOVER_OPTIONS.forEach((opt, i) => {
      const segX = x + 6 + i * (SEGMENT_W + SEGMENT_GAP) + SEGMENT_W / 2;
      const segment = this.addSegment(segX, y + 44, opt.value, opt.label, () =>
        this.setDetailedHoverPreviews(opt.value),
      );
      this.hoverSegments.push(segment);
    });

    this.addText(x, y + 70, "Show full effect details when hovering a target.", {
      fontSize: "12px",
      color: TEXT.textMuted,
    });
  }

  private buildMusicSlider(x: number, y: number): void {
    this.addText(x, y - 20, "Music", {
      fontSize: "14px",
      color: TEXT.textKeyword,
      fontStyle: "bold",
    });

    const current = this.settings.get();
    this.musicSlider = new VolumeSlider(
      this.scene,
      this,
      x + 100,
      y + 5,
      current.musicVolume,
      (value: number) => this.setMusicVolume(value),
    );
  }

  private buildFxSlider(x: number, y: number): void {
    this.addText(x, y - 20, "Sound effects", {
      fontSize: "14px",
      color: TEXT.textKeyword,
      fontStyle: "bold",
    });

    const current = this.settings.get();
    this.fxSlider = new VolumeSlider(
      this.scene,
      this,
      x + 100,
      y + 5,
      current.fxVolume,
      (value: number) => this.setFxVolume(value),
    );
  }

  private buildMuteControl(x: number, y: number): void {
    this.addText(x, y, "Master mute", {
      fontSize: "14px",
      color: TEXT.textKeyword,
      fontStyle: "bold",
    });

    MUTE_OPTIONS.forEach((opt, i) => {
      const segX = x + 6 + i * (SEGMENT_W + SEGMENT_GAP) + SEGMENT_W / 2;
      const segment = this.addSegment(segX, y + 44, opt.value, opt.label, () =>
        this.setMasterMute(opt.value),
      );
      this.muteSegments.push(segment);
    });

    this.addText(x, y + 70, "Silence all audio regardless of slider levels.", {
      fontSize: "12px",
      color: TEXT.textMuted,
    });
  }

  private buildCloseButton(): void {
    const bg = this.scene.add.rectangle(0, 250, 140, 32, UNSELECTED_FILL, 0.95);
    bg.setStrokeStyle(1, UNSELECTED_STROKE, 0.85);
    bg.setRounded(7);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerup", () => this.close());
    this.add(bg);

    const label = this.scene.add.text(
      0,
      250,
      "Close",
      textStyle({ fontSize: "13px", color: TEXT.textLight, fontStyle: "bold" }),
    );
    label.setOrigin(0.5, 0.5);
    this.add(label);
  }

  /** Build one segmented-control button bound to a value + handler. */
  private addSegment<T>(
    x: number,
    y: number,
    value: T,
    labelText: string,
    onClick: () => void,
  ): Segment<T> {
    const bg = this.scene.add.rectangle(x, y, SEGMENT_W, SEGMENT_H, UNSELECTED_FILL, 0.95);
    bg.setStrokeStyle(1, UNSELECTED_STROKE, 0.85);
    bg.setRounded(7);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerup", onClick);
    this.add(bg);

    const label = this.scene.add.text(
      x,
      y,
      labelText,
      textStyle({ fontSize: "12px", color: TEXT.textMuted, fontStyle: "bold" }),
    );
    label.setOrigin(0.5, 0.5);
    this.add(label);

    return { value, bg, label };
  }

  private addText(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text {
    const obj = this.scene.add.text(x, y, text, textStyle(style));
    this.add(obj);
    return obj;
  }

  // -------------------------------------------------------------------------
  // Highlight sync
  // -------------------------------------------------------------------------

  /** Re-render every segment's highlight from the store's current value. */
  private refreshFromStore(): void {
    const current: UserSettings = this.settings.get();
    this.applyHighlight(this.confirmationSegments, current.confirmationMode);
    this.applyHighlight(this.hoverSegments, current.detailedHoverPreviews);
    this.musicSlider.setValue(current.musicVolume);
    this.fxSlider.setValue(current.fxVolume);
    this.applyHighlight(this.muteSegments, current.masterMute);
  }

  private applyHighlight<T>(segments: Segment<T>[], selected: T): void {
    for (const segment of segments) {
      const isSelected = segment.value === selected;
      segment.bg.setFillStyle(isSelected ? SELECTED_FILL : UNSELECTED_FILL, isSelected ? 1 : 0.95);
      segment.bg.setStrokeStyle(
        1,
        isSelected ? SELECTED_STROKE : UNSELECTED_STROKE,
        isSelected ? 1 : 0.85,
      );
      segment.label.setColor(isSelected ? TEXT.textLight : TEXT.textMuted);
    }
  }
}
