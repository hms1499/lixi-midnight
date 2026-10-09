/**
 * Loads something once and shares the result, but forgets a failed load, so a later call tries again
 * (a dropped connection or a redeploy should not stick for the life of the tab).
 */
export const loadOnce = <T>(load: () => Promise<T>): (() => Promise<T>) => {
  let pending: Promise<T> | undefined;
  return () =>
    (pending ??= load().catch((error: unknown) => {
      pending = undefined;
      throw error;
    }));
};
