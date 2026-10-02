// The wallet SDK address codec uses Node's Buffer; browsers need the `buffer` package.
import { Buffer } from 'buffer';

globalThis.Buffer ??= Buffer;
