import type { Page } from 'playwright';
import type { Shot } from './frames.ts';

/**
 * Records a page through the DevTools screencast: high-quality JPEGs, sent only when the page changes, each
 * stamped with the wall-clock time it was painted.
 */
export const startScreencast = async (page: Page): Promise<{ stop(): Promise<Shot[]> }> => {
  const cdp = await page.context().newCDPSession(page);
  const shots: Shot[] = [];
  cdp.on('Page.screencastFrame', (f) => {
    shots.push({ data: Buffer.from(f.data, 'base64'), at: f.metadata.timestamp ?? Date.now() / 1000 });
    void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId });
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080 });
  return {
    stop: async () => {
      await cdp.send('Page.stopScreencast');
      await cdp.detach();
      return shots;
    },
  };
};
