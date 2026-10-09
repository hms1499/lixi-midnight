/** The error with every URL replaced by `<url>`: a claim link's fragment is its secret (CLAUDE.md invariants). */
export const withoutUrls = (error: unknown): Error =>
  new Error((error instanceof Error ? error.message : String(error)).replace(/\bhttps?:\/\/\S+/g, '<url>'));
