import { describe, expect, it } from 'vitest';
import { emptyPrivateState, type LixiPrivateState } from '@lixi/contract';
import { memoryPrivateStateProvider } from '../src/memory-private-state.js';

describe('memoryPrivateStateProvider', () => {
  it('scopes private state to the current contract address', async () => {
    const p = memoryPrivateStateProvider<'lixi', LixiPrivateState>();
    await expect(p.get('lixi')).rejects.toThrow(/setContractAddress/);
    const state = { shares: { ab: [] } };
    p.setContractAddress('aa');
    await p.set('lixi', state);
    expect(await p.get('lixi')).toBe(state);
    p.setContractAddress('bb');
    expect(await p.get('lixi')).toBeNull();
    await p.set('lixi', emptyPrivateState());
    p.setContractAddress('aa');
    expect(await p.get('lixi')).toBe(state);
  });

  it('keeps signing keys by contract address until removed', async () => {
    const p = memoryPrivateStateProvider<'lixi', LixiPrivateState>();
    await p.setSigningKey('aa', 'key');
    expect(await p.getSigningKey('aa')).toBe('key');
    expect(await p.getSigningKey('bb')).toBeNull();
    await p.removeSigningKey('aa');
    expect(await p.getSigningKey('aa')).toBeNull();
  });

  it('refuses export and import instead of pretending to back up', async () => {
    const p = memoryPrivateStateProvider<'lixi', LixiPrivateState>();
    await expect(p.exportPrivateStates()).rejects.toThrow(/not supported/);
  });
});
