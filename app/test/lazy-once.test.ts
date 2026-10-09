import { describe, expect, it, vi } from 'vitest';
import { loadOnce } from '../src/lib/lazy-once';

describe('loadOnce', () => {
  it('loads once and shares the result', async () => {
    const load = vi.fn(async () => 'module');
    const get = loadOnce(load);
    expect(await Promise.all([get(), get()])).toEqual(['module', 'module']);
    expect(load).toHaveBeenCalledOnce();
  });

  it('forgets a failed load, so the next call tries again', async () => {
    const load = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce('module');
    const get = loadOnce(load);
    await expect(get()).rejects.toThrow('Failed to fetch');
    expect(await get()).toBe('module');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
