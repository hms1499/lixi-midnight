import { describe, expect, it, vi } from 'vitest';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { connectWallet, detectWallets, retryingOnce } from '../src/wallet/connector';
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

describe('friendlyError', () => {
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
});
