import { mkdirSync, writeFileSync } from 'node:fs';
import { TOKENS } from '../../app/src/theme.ts';
import { OUT } from './paths.ts';

/** The app's colour tokens as CSS variables, so the video looks like the product. */
export const tokensCss = (): string =>
  `:root {\n${Object.entries(TOKENS)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join('\n')}\n}\n`;

export const writeTokens = (): void => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}tokens.css`, tokensCss());
};
