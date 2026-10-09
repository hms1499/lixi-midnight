export const FPS = 30;
/** Silence before the voice starts, and after it ends. */
export const LEAD = 0.3;
export const TAIL = 0.6;
/** Fade in and out at each scene's edges. */
export const FADE = 0.3;

/** A scene lasts as long as its voice plus padding, or its footage, whichever is longer. */
export const sceneSeconds = (speech: number, footage = 0): number =>
  Math.max(Math.round((LEAD + speech + TAIL) * 1000) / 1000, footage);
