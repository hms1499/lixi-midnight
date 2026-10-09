/** The `claim` circuit's source, read from lixi.compact at build time so the video never shows stale code. */
export const claimCircuit = (source: string): string => {
  const start = source.indexOf('export circuit claim(');
  if (start < 0) throw new Error('claim circuit not found in lixi.compact');
  const end = source.indexOf('\n}\n', start);
  return source.slice(start, end + 2);
};
