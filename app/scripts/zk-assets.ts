// Copies the proving keys and ZKIR of the compiled contract into public/, where
// FetchZkConfigProvider fetches them. Compiles the keys first if `npm test` deleted them.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';

const managed = new URL('../../contract/src/managed/lixi/', import.meta.url);
const pub = new URL('../public/', import.meta.url);

if (!existsSync(new URL('keys/claim.prover', managed))) {
  console.log('proving keys missing: compiling the contract (~1–2 min)...');
  execSync('npm run compact -w @lixi/contract', { stdio: 'inherit', cwd: new URL('../../', import.meta.url) });
}
for (const dir of ['keys', 'zkir']) {
  rmSync(new URL(dir, pub), { recursive: true, force: true });
  cpSync(new URL(dir, managed), new URL(dir, pub), { recursive: true });
}
console.log('copied keys/ and zkir/ into app/public');
