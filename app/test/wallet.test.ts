import { describe, expect, it, vi } from 'vitest';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { balanceOrExplain, connectWallet, detectWallets, retryingOnce } from '../src/wallet/connector';
import { friendlyError } from '../src/wallet/errors';
import { feeNote, feeWarnings, readBalances } from '../src/wallet/balances';

const initial = (over: Partial<InitialAPI> = {}): InitialAPI => ({
  rdns: 'xyz.1am',
  name: '1AM',
  icon: '',
  apiVersion: '4.0.1',
  connect: async () => ({}) as ConnectedAPI,
  ...over,
});

describe('detectWallets', () => {
  it('keeps one compatible 1AM API, and ignores every other wallet', () => {
    const found = detectWallets({
      a: initial(),
      b: initial({ apiVersion: '4.1.0' }),
      c: initial({ rdns: 'io.lace', name: 'Lace', apiVersion: '4.0.1' }),
      d: { name: 'junk' } as unknown as InitialAPI,
      e: initial({ rdns: 'xyz.1am.old', apiVersion: '3.0.0' }),
    });
    expect(found.map((w) => `${w.name} ${w.apiVersion}`)).toEqual(['1AM 4.0.1']);
    expect(detectWallets(undefined)).toEqual([]);
  });
});

describe('retryingOnce', () => {
  it('retries a call once after the idle "Request failed" error, and nothing else', async () => {
    let calls = 0;
    const api = retryingOnce({
      getDustBalance: async () => {
        calls++;
        if (calls === 1) throw new Error('Request failed');
        return { cap: 0n, balance: 5n };
      },
      submitTransaction: async () => {
        throw new Error('Rejected');
      },
    } as unknown as ConnectedAPI);
    expect(await api.getDustBalance()).toEqual({ cap: 0n, balance: 5n });
    expect(calls).toBe(2);
    await expect(api.submitTransaction('00')).rejects.toThrow('Rejected');
  });

  it('also retries the idle error on the proving provider the wallet hands out', async () => {
    let proofs = 0;
    const api = retryingOnce({
      getProvingProvider: async () => ({
        prove: async () => {
          proofs++;
          if (proofs === 1) throw new Error('Request failed');
          return new Uint8Array([1]);
        },
      }),
    } as unknown as ConnectedAPI);
    const provider = await api.getProvingProvider({} as never);
    expect(await provider.prove(new Uint8Array(), 'claim')).toEqual(new Uint8Array([1]));
    expect(proofs).toBe(2);
  });
});

describe('connectWallet', () => {
  it('gives up on a wallet that never answers', async () => {
    vi.useFakeTimers();
    const pending = connectWallet(initial({ connect: () => new Promise(() => {}) }), 'preprod', 60_000);
    const outcome = expect(pending).rejects.toThrow('connect timed out');
    await vi.advanceTimersByTimeAsync(60_000);
    await outcome;
    vi.useRealTimers();
  });

  it('retries connect once after 1AM’s idle "Request failed", the first call when a page has sat a while', async () => {
    let tries = 0;
    const api = { getUnshieldedAddress: async () => ({ unshieldedAddress: 'mn_addr' }) } as unknown as ConnectedAPI;
    const wallet = initial({
      connect: async () => {
        if (++tries === 1) throw new Error('Request failed');
        return api;
      },
    });
    const connected = await connectWallet(wallet, 'preprod');
    expect(tries).toBe(2);
    expect(await connected.getUnshieldedAddress()).toEqual({ unshieldedAddress: 'mn_addr' });
  });

  it('does not retry connect on any other error', async () => {
    let tries = 0;
    const wallet = initial({
      connect: async () => {
        tries++;
        throw new Error('User rejected');
      },
    });
    await expect(connectWallet(wallet, 'preprod')).rejects.toThrow('User rejected');
    expect(tries).toBe(1);
  });
});

describe('balanceOrExplain', () => {
  const wallet = (balance: () => Promise<{ tx: string }>, dust: bigint) =>
    ({
      balanceUnsealedTransaction: balance,
      getDustBalance: async () => ({ cap: 0n, balance: dust }),
    }) as unknown as ConnectedAPI;

  it('returns the balanced transaction', async () => {
    expect(
      await balanceOrExplain(
        wallet(async () => ({ tx: 'ab' }), 0n),
        '00',
      ),
    ).toBe('ab');
  });

  it('reports "no dust" when a wallet with no DUST fails to balance with a bare Error', async () => {
    await expect(
      balanceOrExplain(
        wallet(() => Promise.reject(new Error()), 0n),
        '00',
      ),
    ).rejects.toThrow(/^no dust$/);
  });

  it('keeps the wallet’s own error when it has DUST', async () => {
    const failing = wallet(() => Promise.reject(new Error('node said no')), 5n);
    await expect(balanceOrExplain(failing, '00')).rejects.toThrow('node said no');
  });
});

describe('readBalances', () => {
  const NIGHT = '0'.repeat(64);
  const api = (night: Record<string, bigint>, dust: bigint) =>
    ({
      getUnshieldedBalances: async () => night,
      getDustBalance: async () => ({ balance: dust, cap: dust * 5n }),
    }) as unknown as ConnectedAPI;

  it('reads tNIGHT under the native token type and the DUST balance', async () => {
    expect(await readBalances(api({ [NIGHT]: 4_996_000_000n, ['ab'.repeat(32)]: 7n }, 5n))).toEqual({
      night: 4_996_000_000n,
      dust: 5n,
    });
    expect(await readBalances(api({}, 0n))).toEqual({ night: 0n, dust: 0n });
  });

  it('gives no balances when the wallet cannot answer, rather than an error', async () => {
    const failing = {
      getUnshieldedBalances: async () => ({}),
      getDustBalance: async () => Promise.reject(new Error('x')),
    };
    expect(await readBalances(failing as unknown as ConnectedAPI)).toBeUndefined();
    expect(await readBalances({} as ConnectedAPI)).toBeUndefined();
  });
});

describe('feeWarnings', () => {
  const wallet = (night: bigint, dust: bigint) => ({ balances: { night, dust } });

  it('never warns about DUST, because 1AM pays the fee', () => {
    expect(feeWarnings(wallet(10_000_000n, 0n))).toEqual([]);
  });

  it('warns when the wallet shows less tNIGHT than the envelope needs', () => {
    expect(feeWarnings(wallet(2_500_000n, 0n), 3_000_000n)).toEqual([
      'Your wallet shows 2.5 tNIGHT, less than the 3 tNIGHT this envelope needs.',
    ]);
    expect(feeWarnings(wallet(3_000_000n, 0n), 3_000_000n)).toEqual([]);
  });

  it('says nothing when the balances are unknown', () => {
    expect(feeWarnings({}, 3_000_000n)).toEqual([]);
  });

  it('tells the user who pays the fee', () => {
    expect(feeNote('1AM')).toBe('Fees are paid by 1AM, so your wallet needs no DUST.');
  });
});

describe('friendlyError', () => {
  it('never shows a Blockfrost project id from an error that quotes an endpoint', () => {
    const shown = friendlyError(
      new Error('request to https://midnight-preprod.blockfrost.io/api/v0?project_id=preprodSECRET failed'),
    );
    expect(shown).not.toContain('preprodSECRET');
    expect(shown).toContain('project_id=<redacted>');
  });

  it('turns connector, prover and wallet errors into instructions', () => {
    const connectorError = (code: string) => ({ type: 'DAppConnectorAPIError', code, reason: 'x', message: 'x' });
    expect(friendlyError(connectorError('Rejected'))).toBe('You declined the request in your wallet.');
    expect(friendlyError(new Error('connect timed out'))).toMatch(/extensions menu/);
    expect(friendlyError(new Error('Wallet is syncing — open 1AM and wait for sync to finish'))).toMatch(
      /still syncing/,
    );
    expect(friendlyError(new Error('proof server unreachable'))).toMatch(/docker run/);
    expect(friendlyError(new Error('amounts changed'))).toBe('The amounts just changed. Check them, then seal again.');
    const staleDust =
      "Unexpected error submitting scoped transaction '<unnamed>': Error: Operation failed: 1010: Invalid Transaction: Custom error: 171: (FiberFailure) SubmissionError: Transaction submission error";
    expect(friendlyError(new Error(staleDust))).toBe(
      'The network refused the fee your wallet added, because the wallet’s DUST is out of date. Nothing was sent. Open your wallet, let it finish syncing, and try again in a few minutes.',
    );
    const pending = 'A transaction is already pending. Wait for it to confirm or expire before requesting another.';
    expect(friendlyError(new Error(pending))).toBe(pending);
    expect(friendlyError(new Error('boom'))).toBe(
      'boom. If your wallet just sent another transaction, wait about 30 seconds and try again.',
    );
  });

  it('tells a locked wallet apart from a declined request (Lace sends both as Rejected)', () => {
    const locked = {
      type: 'DAppConnectorAPIError',
      code: 'Rejected',
      reason: 'Wallet is locked. Please unlock the wallet first.',
      message: 'Wallet is locked. Please unlock the wallet first.',
    };
    expect(friendlyError(locked)).toBe('Your wallet is locked. Unlock it, then try again.');
  });

  it('says how to get DUST when the wallet has none to pay the fee', () => {
    const wrapped = "Unexpected error submitting scoped transaction '<unnamed>': Error: no dust";
    expect(friendlyError(new Error(wrapped))).toMatch(/^Your wallet has no DUST to pay the fee\. Nothing was sent\./);
    expect(friendlyError(new Error(wrapped))).toMatch(/let 1AM pay the fee/);
    expect(friendlyError(new Error(wrapped))).not.toMatch(/Lace/);
  });

  it('says how to start a proof server when proving could not reach one', () => {
    const blocked =
      "Unexpected error submitting scoped transaction '<unnamed>': Error: 'check' returned an error: TypeError: Failed to fetch";
    expect(friendlyError(new Error(blocked))).toMatch(/^A proof server could not be reached\./);
    expect(friendlyError(new Error(blocked))).toMatch(/docker run/);
    expect(friendlyError(new Error(blocked))).toMatch(/In 1AM under Advanced/);
    expect(friendlyError(new Error(blocked))).not.toMatch(/Lace/);
  });

  it('drops the SDK wrapper from a failed transaction and keeps what the wallet said', () => {
    const prefix = "Unexpected error submitting scoped transaction '<unnamed>': ";
    expect(friendlyError(new Error(`${prefix}Error: boom`))).toBe(
      'boom. If your wallet just sent another transaction, wait about 30 seconds and try again.',
    );
    expect(friendlyError(new Error(`${prefix}Error`))).toBe(
      'Your wallet could not finish the transaction. If your wallet just sent another transaction, wait about 30 seconds and try again.',
    );
  });
});
