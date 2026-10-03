import { describe, expect, it, vi } from 'vitest';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { balanceOrExplain, connectWallet, detectWallets, retryingOnce } from '../src/wallet/connector';
import { friendlyError } from '../src/wallet/errors';

const initial = (over: Partial<InitialAPI> = {}): InitialAPI => ({
  rdns: 'xyz.1am',
  name: '1AM',
  icon: '',
  apiVersion: '4.0.1',
  connect: async () => ({}) as ConnectedAPI,
  ...over,
});

describe('detectWallets', () => {
  it('keeps one compatible API per wallet', () => {
    const found = detectWallets({
      a: initial(),
      b: initial({ apiVersion: '4.1.0' }),
      c: initial({ rdns: 'io.lace', name: 'Lace', apiVersion: '3.0.0' }),
      d: { name: 'junk' } as unknown as InitialAPI,
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

  it('reports "no dust" when a wallet with no DUST fails to balance (Lace throws a bare Error)', async () => {
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
    expect(friendlyError(new Error(wrapped))).toMatch(/Generate DUST/);
  });

  it('says how to start a proof server when proving could not reach one', () => {
    const blocked =
      "Unexpected error submitting scoped transaction '<unnamed>': Error: 'check' returned an error: TypeError: Failed to fetch";
    expect(friendlyError(new Error(blocked))).toMatch(/^A proof server could not be reached\./);
    expect(friendlyError(new Error(blocked))).toMatch(/docker run/);
    expect(friendlyError(new Error(blocked))).toMatch(/Proof Server, Local/);
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
