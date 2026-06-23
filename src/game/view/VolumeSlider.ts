import Phaser from "phaser";
import { TEXT, textStyle } from "./presentation";

// ---------------------------------------------------------------------------
// Pure slider math — extracted so the mapping logic is unit-testable without
// Phaser pointers.  These are exported as named functions; VolumeSlider uses
// them internally but callers testing interaction can also import them directly.
// ---------------------------------------------------------------------------

/**
 * Convert a horizontal pixel coordinate to a clamped [0, 1] slider value.
 * `startX` is the left edge of the track, `endX` the right edge.
 */
export function positionToValue(x: number, startX: number, endX: number): number {
  const ratio = (x - startX) / (endX - startX);
  return Math.max(0, Math.min(1, ratio));
}

/** Convert a [0, 1] slider value to the horizontal pixel coordinate of the thumb centre. */
export function valueToPosition(value: number, startX: number, endX: number): number {
  return startX + value * (endX - startX);
}

// ---------------------------------------------------------------------------
// VolumeSlider — Phaser GameObjects wrapped in a class so the overlay can own
// one per channel and drive it from either pointer events or the store's
// persisted value.
// ---------------------------------------------------------------------------

/** Dimensions of the slider track, thumb, and spacing. */
const TRACK_W = 200;
const TRACK_H = 8;
const TRACK_RADIUS = 4;
const THUMB_SIZE = 18;

// Colours — track / fill / label drawn against the dark panel.
const TRACK_FILL = 0x1a2235;
const TRACK_STROKE = 0x31415d;
const FILL_COLOR = 0x88ccff;

/** Internal shape of a slider after construction. */
interface SliderParts {
  readonly track: Phaser.GameObjects.Rectangle;
  readonly fill: Phaser.GameObjects.Rectangle;
  readonly thumb: Phaser.GameObjects.Container;
  readonly label: Phaser.GameObjects.Text;
}

export class VolumeSlider {
  private readonly parts: SliderParts;
  private readonly _onValueChange: (value: number) => void;

  /**
   * @param scene — parent Phaser scene
   * @param container — the overlay container (slider objects are added here)
   * @param x — centre-x of the slider (track is centred on this)
   * @param y — vertical position for the track and label
   * @param initialValue — starting value in [0, 1]
   * @param onValueChange — callback fired continuously during drags
   */
  constructor(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    initialValue: number,
    onValueChange: (value: number) => void,
  ) {
    this._onValueChange = onValueChange;
    const halfW = TRACK_W / 2;
    const startX = x - halfW;

    // Track background.
    const track = scene.add.rectangle(x, y, TRACK_W, TRACK_H, TRACK_FILL, 1);
    track.setStrokeStyle(1, TRACK_STROKE, 0.85);
    track.setRounded(TRACK_RADIUS);
    container.add(track);

    // Coloured fill bar — grows left→right inside the track bounds.
    const fill = scene.add.rectangle(startX, y, TRACK_W, TRACK_H, FILL_COLOR, 0.85);
    fill.setOrigin(0, 0.5); // origin at left edge so width grows right from startX
    fill.setRounded(TRACK_RADIUS);
    container.add(fill);

    // Thumb — circle drag handle centred on the fill right edge.
    const thumb = scene.add.container(startX, y);
    const thumbDot = scene.add.circle(0, 0, THUMB_SIZE / 2, FILL_COLOR, 1);
    thumb.add(thumbDot);
    container.add(thumb);

    // Percentage label — sits to the right of the track end.
    const label = scene.add.text(
      x + halfW + 12,
      y,
      "",
      textStyle({ fontSize: "13px", color: TEXT.textMuted }),
    );
    label.setOrigin(0, 0.5);
    container.add(label).setName("label");

    this.parts = { track, fill, thumb, label };

    // Wire pointer events last so initial setValue doesn't trip them.
    this.setValue(initialValue);
    this.wirePointerEvents(scene, thumbDot);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  startX(): number {
    return this.parts.track.getWorldPoint().x - this.parts.track.width / 2;
  }

  endX(): number {
    return this.startX() + this.parts.track.width;
  }

  /** Read the current value [0, 1] by mapping thumb centre position back to track space. */
  getValue(): number {
    return positionToValue(this.parts.thumb.getWorldPoint().x, this.startX(), this.endX());
  }

  /** Jump the slider to a new visual value (no callback). Used from refreshFromStore. */
  setValue(value: number): void {
    const clamped = Math.max(0, Math.min(1, value));

    // Thumb centre position for this value.
    const thumbCentre = valueToPosition(
      clamped,
      this.parts.track.x,
      this.parts.track.x + this.parts.track.width,
    );
    this.parts.thumb.x = thumbCentre - TRACK_W / 2;
    this.parts.fill.setScale(clamped, 1);
    this.parts.label.setText(`${Math.round(clamped * 100)}%`);
  }

  // -----------------------------------------------------------------------
  // Pointer drag wiring
  // -----------------------------------------------------------------------

  private wirePointerEvents(scene: Phaser.Scene, thumbDot: Phaser.GameObjects.Arc): void {
    let isDragging = false;

    const applyDrag = (pointerX: number) => {
      const clamped = positionToValue(pointerX, this.startX(), this.endX());
      this.setValue(clamped);
      this._onValueChange(Math.round(clamped * 100) / 100); // round to 2 decimals for stable store writes
    };

    const onDrag = (pointer: Phaser.Input.Pointer) => {
      if (!isDragging) return;
      applyDrag(pointer.x);
    };

    const onEnd = () => {
      isDragging = false;
    };

    // Track: pointerdown → start drag immediately and move thumb to click point.
    this.parts.track.setInteractive();
    this.parts.track.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      isDragging = true;
      applyDrag(pointer.x);
    });

    // Thumb circle (inside the container): pointerdown → start drag.
    // Use the Circle directly instead of the Container — Phaser 3.90
    // auto-hitArea on Containers can leave hitAreaCallback as null,
    // causing 'pointWithinHitArea' to crash during input updates.
    thumbDot.setInteractive({ useHandCursor: true });
    thumbDot.on("pointerdown", () => {
      isDragging = true;
    });

    // Fill: also starts a drag with no dead zones.
    this.parts.fill.setInteractive();
    this.parts.fill.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      isDragging = true;
      applyDrag(pointer.x);
    });

    // Global pointer-up and move so dragging works even if cursor leaves track area.
    const input = scene.input;
    input.on("pointermove", onDrag);
    input.on("pointerup", onEnd);
    input.on("pointerupoutside", onEnd);
  }
}
