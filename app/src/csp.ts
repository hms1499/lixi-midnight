import { NETWORKS, type NetworkName } from '@lixi/sdk/network';

/**
 * Content-Security-Policy for every page (spec §4.5, audit Low). Scripts and styles come only from
 * our origin, WebAssembly may compile (the ledger runtime), and the page may only talk to our origin,
 * the network's public indexer and the local proof server (audit H4).
 *
 * The proof server is listed under both its loopback names: Lace proves through its "Local" setting,
 * http://localhost:6300, which CSP treats as another host than 127.0.0.1 (spike S4 retest).
 */
export const cspFor = (network: NetworkName): string => {
  const n = NETWORKS[network];
  const prover = new URL(n.proofServer);
  const connect = [n.indexer, n.indexerWS, n.proofServer, `${prover.protocol}//localhost:${prover.port}`].map(
    (url) => new URL(url).origin,
  );
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self'",
    "img-src 'self' data:",
    `connect-src 'self' ${connect.join(' ')}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
};
