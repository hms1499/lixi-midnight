/** The parts of `navigator` that tell a phone or tablet apart. `userAgentData` is Chromium-only. */
export type NavigatorLike = {
  readonly userAgent: string;
  readonly maxTouchPoints?: number;
  readonly userAgentData?: { readonly mobile?: boolean };
};

/** True on a phone or tablet. Lixi needs the 1AM extension, which runs only in a desktop browser (§3.2). */
export const isMobile = (nav: NavigatorLike): boolean => {
  if (nav.userAgentData?.mobile) return true;
  if (/Android|iPhone|iPad|iPod/i.test(nav.userAgent)) return true;
  // iPadOS reports a Mac user agent; only the touch screen gives it away.
  return /Macintosh/.test(nav.userAgent) && (nav.maxTouchPoints ?? 0) > 1;
};
