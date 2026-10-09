/** The parts of Vite's build manifest (`dist/.vite/manifest.json`) this check reads. */
export type ManifestChunk = {
  readonly file: string;
  readonly isEntry?: boolean;
  readonly imports?: readonly string[];
  readonly dynamicImports?: readonly string[];
  readonly assets?: readonly string[];
};
export type Manifest = Readonly<Record<string, ManifestChunk>>;

const keysFromEntry = (manifest: Manifest): string[] => {
  const entry = Object.keys(manifest).find((k) => manifest[k].isEntry);
  if (!entry) throw new Error('no entry chunk in the manifest');
  const seen = new Set<string>();
  const visit = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    for (const next of manifest[key].imports ?? []) visit(next);
  };
  visit(entry);
  return [...seen];
};

/** Files the browser loads before the first paint: the entry chunk and its static imports, transitively. */
export const staticGraph = (manifest: Manifest): string[] => keysFromEntry(manifest).map((k) => manifest[k].file);

/** The first file loaded before the first paint that brings in WebAssembly, or undefined (user moments spec §3.1). */
export const wasmInEntry = (manifest: Manifest, read: (file: string) => string): string | undefined => {
  for (const key of keysFromEntry(manifest)) {
    const chunk = manifest[key];
    const asset = chunk.assets?.find((a) => a.endsWith('.wasm'));
    if (asset) return asset;
    if (/\.wasm\b/.test(read(chunk.file))) return chunk.file;
  }
  return undefined;
};
