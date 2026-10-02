/**
 * Colour tokens (frontend spec §4.1). `index.css` declares the same values as Tailwind theme
 * colours; `test/theme.test.ts` keeps the two equal and checks every text pair's contrast.
 */
export const TOKENS = {
  night: '#0c0a12',
  'night-deep': '#08070c',
  ember: '#2a0f16',
  lantern: '#ef3346',
  'lantern-deep': '#d42a3c',
  'envelope-flap': '#8f0c1b',
  seal: '#f2c14e',
  'seal-ink': '#2a1a05',
  paper: '#efe2cf',
  'paper-soft': '#b3a593',
  'paper-dim': '#8c7f8a',
  out: '#221a21',
  error: '#ff6b78',
} as const;

export type Token = keyof typeof TOKENS;

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2 contrast ratio between two `#rrggbb` colours. */
export const contrast = (fg: string, bg: string): number => {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};
