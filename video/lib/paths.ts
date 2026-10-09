import { fileURLToPath } from 'node:url';

/** The repository root, the video folder and its output folder, each ending in '/'. */
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const VIDEO = fileURLToPath(new URL('../', import.meta.url));
export const OUT = `${VIDEO}out/`;
