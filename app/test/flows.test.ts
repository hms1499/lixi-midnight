import { describe, expect, it } from 'vitest';
import { backupString, deriveEnvelope, linksFor, type ClaimLink } from '@lixi/sdk';
import { createEnvelope, freeIndex, type CreateForm } from '../src/flows/create';
import { claimWithLink, previewClaim } from '../src/flows/claim';
import { forgetEnvelope, refundEnvelope, restoreVault } from '../src/flows/manage';
import { envelopeView } from '../src/lib/status';
import { localVaultStore } from '../src/lib/storage';
import { HOUR, LixiSimulator, MemoryStorage, T0, rnd, simChain } from './helpers';

const form = (over: Partial<CreateForm> = {}): CreateForm => ({
  total: 3_000_000n,
  count: 3,
  split: 'equal',
  kind: 'personal',
  durationSeconds: 2 * HOUR,
  ...over,
});

const setup = () => {
  const sim = new LixiSimulator(BigInt(HOUR));
  const chain = simChain(sim);
  const store = localVaultStore(new MemoryStorage());
  const refundAddress = rnd();
  const create = (over: Partial<CreateForm> = {}) => createEnvelope(chain, store, form(over), refundAddress, sim.now);
  const linksOf = (index: number): ClaimLink[] => {
    const vault = store.load()!;
    return linksFor(
      deriveEnvelope(
        vault.seed,
        vault.envelopes.find((e) => e.index === index)!,
      ),
    );
  };
  return { sim, chain, store, refundAddress, create, linksOf, now: () => sim.now };
};

describe('createEnvelope', () => {
  it('saves the vault entry, then creates the envelope on chain', async () => {
    const { sim, store, create } = setup();
    const { id } = await create();
    const vault = store.load()!;
    expect(vault.envelopes).toHaveLength(1);
    expect(vault.envelopes[0]).toMatchObject({ index: 0, total: 3_000_000n, count: 3, expiry: BigInt(T0 + 2 * HOUR) });
    expect(sim.ledger().envelopes.member(id)).toBe(true);
    expect(store.backedUp()).toBe(false);
  });

  it('keeps the vault entry when the transaction fails, and the dashboard shows it as missing', async () => {
    const { sim, chain, store, create } = setup();
    chain.create = async () => {
      throw new Error('Rejected');
    };
    await expect(create()).rejects.toThrow('Rejected');
    const vault = store.load()!;
    expect(envelopeView(sim.ledger(), vault.seed, vault.envelopes[0], sim.now).state).toBe('missing');
    forgetEnvelope(store, 0);
    expect(store.load()!.envelopes).toHaveLength(0);
  });

  it('skips an index whose envelope is already on chain but missing from the vault', async () => {
    const { store, create } = setup();
    await create();
    forgetEnvelope(store, 0); // the vault lost it, the chain did not
    await create();
    expect(store.load()!.envelopes.map((e) => e.index)).toEqual([1]);
  });

  it('previews the amounts of exactly the index it will seal', async () => {
    const { sim, store, create } = setup();
    await create();
    forgetEnvelope(store, 0); // index 0 is on chain but no longer in the vault
    const vault = store.load()!;
    const index = freeIndex(vault, sim.ledger());
    expect(index).toBe(1);
    const preview = deriveEnvelope(vault.seed, {
      index,
      total: 5_000_000n,
      count: 4,
      kind: 'personal',
      split: 'random',
    });
    await create({ total: 5_000_000n, count: 4, split: 'random' });
    const sealed = store.load()!.envelopes.find((e) => e.index === index)!;
    expect(deriveEnvelope(store.load()!.seed, sealed).shares).toEqual(preview.shares);
  });

  it('refuses to seal another index than the one previewed, before touching the vault', async () => {
    const { sim, chain, store, refundAddress } = setup();
    await expect(createEnvelope(chain, store, form(), refundAddress, sim.now, 1)).rejects.toThrow('amounts changed');
    expect(store.load()!.envelopes).toHaveLength(0);
    expect(chain.calls).toEqual([]);
  });

  it('never reuses the index of a removed envelope, which may still be on its way', async () => {
    const { chain, store, create } = setup();
    const realCreate = chain.create;
    chain.create = async () => {
      throw new Error('Rejected');
    };
    await expect(create()).rejects.toThrow('Rejected');
    forgetEnvelope(store, 0);
    chain.create = realCreate;
    await create();
    expect(store.load()!.envelopes.map((e) => e.index)).toEqual([1]);
  });

  it('refuses expiries outside the contract bounds before touching the vault', async () => {
    const { store, create } = setup();
    await expect(create({ durationSeconds: HOUR })).rejects.toThrow('expiry out of range');
    await expect(create({ durationSeconds: 30 * 86400 })).rejects.toThrow('expiry out of range');
    expect(store.load()).toBeUndefined();
  });

  it('rejects a random split for a group link', async () => {
    const { create } = setup();
    await expect(create({ kind: 'group', split: 'random' })).rejects.toThrow(/equal split/);
  });
});

describe('claim', () => {
  it('previews, claims and pays the exact share', async () => {
    const { sim, chain, create, linksOf, now } = setup();
    await create({ split: 'random' });
    const [link] = linksOf(0);
    const preview = previewClaim(sim.ledger(), link, sim.now);
    expect(preview).toMatchObject({ ok: true, expiringSoon: false });
    const who = rnd();
    const result = await claimWithLink(chain, link, who, now);
    expect(result).toEqual({ ok: true, amount: preview.ok && preview.amount, total: 3_000_000n, txHash: 'tx2' });
    expect(previewClaim(sim.ledger(), link, sim.now)).toEqual({ ok: false, reason: 'already claimed' });
    expect(await claimWithLink(chain, link, rnd(), now)).toEqual({ ok: false, reason: 'already claimed' });
  });

  it('warns when less than 10 minutes are left, and refuses after expiry', async () => {
    const { sim, create, linksOf } = setup();
    await create();
    const [link] = linksOf(0);
    sim.now = T0 + 2 * HOUR - 300;
    expect(previewClaim(sim.ledger(), link, sim.now)).toMatchObject({ ok: true, expiringSoon: true });
    sim.now = T0 + 2 * HOUR;
    expect(previewClaim(sim.ledger(), link, sim.now)).toEqual({ ok: false, reason: 'expired' });
  });

  it('says "no envelope" for a link from another deployment', async () => {
    const { sim, linksOf, create } = setup();
    await create();
    const [link] = linksOf(0);
    const other = new LixiSimulator(BigInt(HOUR));
    expect(previewClaim(other.ledger(), link, sim.now)).toEqual({ ok: false, reason: 'no envelope' });
  });

  it('a group link pays each wallet once and retries when another claimer takes its share', async () => {
    const { sim, chain, create, linksOf, now } = setup();
    await create({ kind: 'group', count: 2, total: 2_000_000n });
    const [link] = linksOf(0);
    const alice = rnd();
    expect(await claimWithLink(chain, link, alice, now)).toMatchObject({ ok: true, amount: 1_000_000n });
    expect(await claimWithLink(chain, link, alice, now)).toEqual({ ok: false, reason: 'address already claimed' });

    // Bob's first submission loses a race: someone claims the last share first.
    const realClaim = chain.claim;
    let raced = false;
    chain.claim = async (args) => {
      if (!raced) {
        raced = true;
        await realClaim({ ...args, recipient: rnd() }); // the other claimer lands first, paid to their own address...
        throw new Error('nullifier already used'); // ...so Bob's transaction fails
      }
      return realClaim(args);
    };
    expect(await claimWithLink(chain, link, rnd(), now)).toEqual({ ok: false, reason: 'all shares claimed' });
    expect(previewClaim(sim.ledger(), link, sim.now)).toEqual({ ok: false, reason: 'all shares claimed' });
  });

  it('reports the payout when a group claim landed but the wallet call still failed', async () => {
    const { chain, create, linksOf, now } = setup();
    await create({ kind: 'group', count: 2, total: 2_000_000n });
    const realClaim = chain.claim;
    chain.claim = async (a) => {
      await realClaim(a);
      throw new Error('Request failed');
    };
    expect(await claimWithLink(chain, linksOf(0)[0], rnd(), now)).toMatchObject({ ok: true, amount: 1_000_000n });
  });

  it('rethrows a failure that is not a lost race, such as the user declining in the wallet', async () => {
    const { chain, create, linksOf, now } = setup();
    await create();
    chain.claim = async () => {
      throw new Error('Rejected');
    };
    await expect(claimWithLink(chain, linksOf(0)[0], rnd(), now)).rejects.toThrow('Rejected');
  });

  it('prefers "refunded" over "already claimed"', async () => {
    const { sim, chain, store, create, linksOf, now } = setup();
    await create({ count: 1, total: 1_000_000n });
    const [link] = linksOf(0);
    sim.now = T0 + 2 * HOUR;
    expect(await refundEnvelope(chain, store.load()!, 0, sim.now)).toMatchObject({ ok: true });
    expect(await claimWithLink(chain, link, rnd(), now)).toEqual({ ok: false, reason: 'refunded' });
  });

  it('reports every stage of a claim, a create and a refund', async () => {
    const { sim, chain, store, linksOf, now } = setup();
    const seen: string[] = [];
    await createEnvelope(chain, store, form(), rnd(), sim.now, undefined, (s) => seen.push(s));
    expect(seen).toEqual(['proving', 'confirm', 'sending', 'waiting']);
    seen.length = 0;
    await claimWithLink(chain, linksOf(0)[0], rnd(), now, (s) => seen.push(s));
    expect(seen).toEqual(['proving', 'confirm', 'sending', 'waiting']);
    seen.length = 0;
    sim.now = T0 + 2 * HOUR;
    await refundEnvelope(chain, store.load()!, 0, sim.now, (s) => seen.push(s));
    expect(seen).toEqual(['proving', 'confirm', 'sending', 'waiting']);
  });

  it('starts again from proving when a group claim retries after losing a race', async () => {
    const { chain, create, linksOf, now } = setup();
    await create({ kind: 'group', count: 2, total: 2_000_000n });
    const [link] = linksOf(0);
    const realClaim = chain.claim;
    let first = true;
    chain.claim = async (args, onStage) => {
      if (first) {
        first = false;
        onStage?.('proving');
        onStage?.('confirm');
        await realClaim({ ...args, recipient: rnd() }); // someone else takes this share first
        throw new Error('Rejected');
      }
      return realClaim(args, onStage);
    };
    const seen: string[] = [];
    const realRead = chain.readLedger;
    chain.readLedger = async () => {
      seen.push('read');
      return realRead();
    };
    expect(await claimWithLink(chain, link, rnd(), now, (s) => seen.push(s))).toMatchObject({ ok: true });
    // The retry shows "proving" as soon as it decides to retry, not after the next attempt's reads.
    expect(seen).toEqual([
      'read',
      'proving',
      'confirm',
      'read',
      'proving',
      'read',
      'proving',
      'confirm',
      'sending',
      'waiting',
    ]);
  });
});

describe('dashboard state and refund', () => {
  it('tracks claims, offers refund only after expiry, and refunds exactly the unclaimed rest', async () => {
    const { sim, chain, store, refundAddress, create, linksOf, now } = setup();
    await create({ count: 3, total: 3_000_000n });
    const vault = () => store.load()!;
    const view = () => envelopeView(sim.ledger(), vault().seed, vault().envelopes[0], sim.now);
    expect(view()).toMatchObject({ state: 'open', claimed: 0, unclaimedAmount: 3_000_000n });

    await claimWithLink(chain, linksOf(0)[1], rnd(), now);
    expect(view()).toMatchObject({ state: 'open', claimed: 1, unclaimedAmount: 2_000_000n });
    expect(view().shares.map((s) => s.opened)).toEqual([false, true, false]);
    expect(await refundEnvelope(chain, vault(), 0, sim.now)).toEqual({ ok: false, reason: 'not expired' });

    sim.now = T0 + 2 * HOUR;
    expect(view().state).toBe('refundable');
    expect(await refundEnvelope(chain, vault(), 0, sim.now)).toMatchObject({ ok: true });
    expect(sim.lastPayouts().get(Buffer.from(refundAddress).toString('hex'))).toBe(2_000_000n);
    expect(view().state).toBe('refunded');
    expect(await refundEnvelope(chain, vault(), 0, sim.now)).toEqual({ ok: false, reason: 'refunded' });
  });

  it('shows a fully claimed envelope as empty', async () => {
    const { sim, chain, store, create, linksOf, now } = setup();
    await create({ count: 2, total: 2_000_000n });
    for (const link of linksOf(0)) await claimWithLink(chain, link, rnd(), now);
    const vault = store.load()!;
    expect(envelopeView(sim.ledger(), vault.seed, vault.envelopes[0], sim.now)).toMatchObject({
      state: 'empty',
      claimed: 2,
    });
  });
});

describe('restoreVault', () => {
  it('rebuilds every envelope from the backup string alone', async () => {
    const { chain, store, create } = setup();
    await create({ split: 'random', count: 5, total: 5_000_000n });
    await create({ kind: 'group', count: 4, total: 4_000_000n });
    const { backupString } = await import('@lixi/sdk');
    const backup = backupString(store.load()!);
    const fresh = localVaultStore(new MemoryStorage());
    expect(await restoreVault(chain, fresh, `  ${backup}\n`, { replaceDifferent: false })).toEqual({
      ok: true,
      found: 2,
    });
    expect(fresh.load()!.envelopes.map(({ index, count, kind, split }) => ({ index, count, kind, split }))).toEqual(
      store.load()!.envelopes.map(({ index, count, kind, split }) => ({ index, count, kind, split })),
    );
    expect(fresh.backedUp()).toBe(true);
  });

  it('finds an envelope sealed after five failed attempts', async () => {
    const { chain, store, create } = setup();
    const realCreate = chain.create;
    chain.create = async () => {
      throw new Error('Rejected');
    };
    for (let i = 0; i < 5; i++) await expect(create()).rejects.toThrow('Rejected');
    chain.create = realCreate;
    await create();
    const fresh = localVaultStore(new MemoryStorage());
    expect(await restoreVault(chain, fresh, backupString(store.load()!), { replaceDifferent: false })).toEqual({
      ok: true,
      found: 1,
    });
    expect(fresh.load()!.envelopes.map((e) => e.index)).toEqual([5]);
  });

  it('restoring the same string keeps the envelopes the chain does not know', async () => {
    const { chain, store, create } = setup();
    await create();
    const realCreate = chain.create;
    chain.create = async () => {
      throw new Error('Rejected');
    };
    await expect(create()).rejects.toThrow('Rejected'); // index 1 stays in the vault as "not on chain"
    chain.create = realCreate;
    expect(await restoreVault(chain, store, backupString(store.load()!), { replaceDifferent: false })).toEqual({
      ok: true,
      found: 1,
    });
    expect(store.load()!.envelopes.map((e) => e.index)).toEqual([0, 1]);
  });

  it('will not silently replace a vault that holds envelopes under another seed', async () => {
    const a = setup();
    await a.create();
    const b = setup();
    await b.create();
    const { backupString } = await import('@lixi/sdk');
    const backupB = backupString(b.store.load()!);
    expect(await restoreVault(a.chain, a.store, backupB, { replaceDifferent: false })).toEqual({
      ok: false,
      reason: 'different seed',
    });
    expect(await restoreVault(a.chain, a.store, 'hello', { replaceDifferent: true })).toEqual({
      ok: false,
      reason: 'not a backup',
    });
    expect(await restoreVault(a.chain, a.store, backupB, { replaceDifferent: true })).toMatchObject({ ok: true });
  });
});
