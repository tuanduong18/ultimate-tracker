import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { moved, useArrange } from '@/lib/hooks/use-arrange';

const row = (id: string) => ({ id });

describe('moved', () => {
  it('takes an entry out and puts it back at the new index', () => {
    expect(moved(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moved(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('leaves the original alone', () => {
    const list = ['a', 'b'];
    moved(list, 0, 1);
    expect(list).toEqual(['a', 'b']);
  });
});

describe('useArrange', () => {
  it('draws the server order until arranging starts', () => {
    const items = [row('a'), row('b')];
    const { result } = renderHook(() => useArrange(items));

    expect(result.current.arranging).toBe(false);
    expect(result.current.ordered).toEqual(items);
    expect(result.current.changed).toBe(false);
  });

  it('keeps moves in a draft that stopping throws away', () => {
    const items = [row('a'), row('b'), row('c')];
    const { result } = renderHook(() => useArrange(items));

    act(() => result.current.start());
    act(() => result.current.move(2, 0));
    expect(result.current.ordered.map((item) => item.id)).toEqual(['c', 'a', 'b']);
    expect(result.current.changed).toBe(true);

    act(() => result.current.stop());
    expect(result.current.ordered.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('puts a row the draft never saw first, and drops one that is gone', () => {
    let items = [row('a'), row('b')];
    const { result, rerender } = renderHook(() => useArrange(items));

    act(() => result.current.start());
    act(() => result.current.move(1, 0));
    // A reload while arranging: "a" deleted elsewhere, "n" added elsewhere.
    items = [row('n'), row('b')];
    rerender();

    expect(result.current.ordered.map((item) => item.id)).toEqual(['n', 'b']);
  });
});
