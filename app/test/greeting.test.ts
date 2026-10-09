import { describe, expect, it } from 'vitest';
import { DEFAULT_GREETING, GREETING_KEY, loadGreeting, saveGreeting, shareMessage } from '../src/lib/greeting';
import { MemoryStorage } from './helpers';

const expiry = new Date(Date.UTC(2026, 9, 12, 21, 0));

describe('greeting', () => {
  it('puts the greeting, the expiry with its time zone, and the link alone on the last line', () => {
    const lines = shareMessage({
      greeting: 'Chúc mừng năm mới!',
      url: 'https://lixi.test/c#v1.x',
      expiry,
      locale: 'en-GB',
      timeZone: 'UTC',
    }).split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Chúc mừng năm mới!');
    expect(lines[1]).toMatch(/^A lì xì for you on Lixi\. Open it before .*12.*2026.*21:00.*UTC.*:$/);
    expect(lines[2]).toBe('https://lixi.test/c#v1.x');
  });

  it('leaves the first line out when the greeting is empty', () => {
    const message = shareMessage({ greeting: '   ', url: 'https://lixi.test/c#v1.x', expiry, timeZone: 'UTC' });
    expect(message.split('\n')[0]).toMatch(/^A lì xì for you on Lixi/);
  });

  it('remembers the greeting per browser, with a default', () => {
    const storage = new MemoryStorage();
    expect(loadGreeting(storage)).toBe(DEFAULT_GREETING);
    saveGreeting(storage, 'Happy birthday!');
    expect(storage.getItem(GREETING_KEY)).toBe('Happy birthday!');
    expect(loadGreeting(storage)).toBe('Happy birthday!');
  });

  it('falls back to the default when storage throws, and never throws itself', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    } as unknown as Storage;
    expect(loadGreeting(broken)).toBe(DEFAULT_GREETING);
    expect(() => saveGreeting(broken, 'x')).not.toThrow();
  });
});
