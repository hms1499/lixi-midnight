export const FPS = 30;
/** Time before the (unheard) voice starts, and after it ends: the voice only paces scenes and captions. */
export const LEAD = 0.3;
export const TAIL = 0.6;
/** Fade in and out at each scene's edges. */
export const FADE = 0.3;
/** The music fades in at the start of the video and out at its end. */
export const MUSIC_FADE_IN = 2;
export const MUSIC_FADE_OUT = 3;

/** A scene lasts as long as its voice plus padding, or its footage, whichever is longer. */
export const sceneSeconds = (speech: number, footage = 0): number =>
  Math.max(Math.round((LEAD + speech + TAIL) * 1000) / 1000, footage);
