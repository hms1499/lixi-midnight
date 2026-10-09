export const GREETING_KEY = 'lixi.greeting';
export const DEFAULT_GREETING = 'Chúc mừng năm mới!';
export const GREETING_MAX = 120;

/** The sender's greeting, remembered per browser as a convenience; storage that throws gives the default (spec §3.3). */
export const loadGreeting = (storage: Storage): string => {
  try {
    return storage.getItem(GREETING_KEY) ?? DEFAULT_GREETING;
  } catch {
    return DEFAULT_GREETING;
  }
};

export const saveGreeting = (storage: Storage, greeting: string): void => {
  try {
    storage.setItem(GREETING_KEY, greeting);
  } catch {
    // A convenience only: the page works without it.
  }
};

/**
 * The chat message for one link (user moments spec §3.3). The expiry carries a time zone, since the
 * recipient may live elsewhere, and the URL sits alone on the last line so chat apps turn it into a link.
 */
export const shareMessage = ({
  greeting,
  url,
  expiry,
  locale,
  timeZone,
}: {
  greeting: string;
  url: string;
  expiry: Date;
  locale?: string;
  timeZone?: string;
}): string => {
  const when = expiry.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone,
  });
  return [greeting.trim(), `A lì xì for you on Lixi. Open it before ${when}:`, url].filter((l) => l !== '').join('\n');
};
