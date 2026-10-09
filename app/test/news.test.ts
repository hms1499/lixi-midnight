import { describe, expect, it } from 'vitest';
import { newlyOpened } from '../src/lib/news';
import type { EnvelopeView } from '../src/lib/status';

const view = (idHex: string, opened: boolean[], state = 'open', amounts = opened.map(() => 1_000_000n)) =>
  ({ idHex, state, shares: opened.map((o, i) => ({ amount: amounts[i], opened: o })) }) as unknown as EnvelopeView;

describe('newlyOpened', () => {
  it('says one lì xì was opened, with its amount', () => {
    expect(newlyOpened([view('a', [false, false])], [view('a', [true, false], 'open', [1_277_978n, 1n])])).toEqual([
      { idHex: 'a', text: 'A lì xì was just opened: 1.277978 tNIGHT.' },
    ]);
  });

  it('adds up several opened in one read', () => {
    expect(newlyOpened([view('a', [false, false, false])], [view('a', [true, true, true])])).toEqual([
      { idHex: 'a', text: '3 lì xì were just opened: 3 tNIGHT.' },
    ]);
  });

  it('makes one item per envelope, in the order of the new read', () => {
    const before = [view('b', [false]), view('a', [false])];
    const after = [view('b', [true]), view('a', [true])];
    expect(newlyOpened(before, after).map((n) => n.idHex)).toEqual(['b', 'a']);
  });

  it('says nothing for an unchanged read, a refund, or an envelope new to the vault', () => {
    expect(newlyOpened([view('a', [true, false])], [view('a', [true, false])])).toEqual([]);
    expect(newlyOpened([view('a', [true, false], 'refundable')], [view('a', [true, false], 'refunded')])).toEqual([]);
    expect(newlyOpened([], [view('new', [true])])).toEqual([]);
  });
});
