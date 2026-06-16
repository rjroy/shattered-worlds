import Phaser from "phaser";

import { CANVAS_H, CANVAS_W } from "./layout";

export type ScreenBackdropOptions = {
  readonly key: string;
  readonly alpha?: number;
  readonly tint?: number;
  readonly veilColor?: number;
  readonly veilAlpha?: number;
};

export function addScreenBackdrop(
  scene: Phaser.Scene,
  options: ScreenBackdropOptions,
): Phaser.GameObjects.Container {
  const container = scene.add.container(CANVAS_W / 2, CANVAS_H / 2);

  if (scene.textures.exists(options.key)) {
    const image = scene.add.image(0, 0, options.key);
    image.setDisplaySize(CANVAS_W, CANVAS_H);
    image.setAlpha(options.alpha ?? 1);
    if (options.tint !== undefined) image.setTint(options.tint);
    container.add(image);
  } else {
    container.add(scene.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x0d0a12, 1));
  }

  container.add(scene.add.rectangle(
    0,
    0,
    CANVAS_W,
    CANVAS_H,
    options.veilColor ?? 0x050409,
    options.veilAlpha ?? 0.68,
  ));

  return container;
}
