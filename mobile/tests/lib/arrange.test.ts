import { inDraftOrder, moved, orderChanged } from '@/lib/arrange';

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

describe('inDraftOrder', () => {
  it('puts a row the draft never saw first, and drops one that is gone', () => {
    // A reload while arranging: "a" deleted elsewhere, "n" added elsewhere.
    expect(inDraftOrder([row('n'), row('b')], ['b', 'a']).map((r) => r.id)).toEqual(['n', 'b']);
  });
});

describe('orderChanged', () => {
  it('is false for the stored order and true for anything else', () => {
    const stored = [row('a'), row('b')];
    expect(orderChanged(stored, stored)).toBe(false);
    expect(orderChanged([row('b'), row('a')], stored)).toBe(true);
  });
});
