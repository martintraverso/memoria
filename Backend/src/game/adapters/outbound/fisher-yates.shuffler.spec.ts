import { FisherYatesShuffler } from './fisher-yates.shuffler';

describe('FisherYatesShuffler', () => {
  const items = ['a', 'b', 'c', 'd', 'e'];

  it('returns a permutation of the items without changing the input', () => {
    const input = [...items];

    const shuffled = new FisherYatesShuffler().shuffle(input);

    expect(input).toEqual(items);
    expect(shuffled).not.toBe(input);
    expect([...shuffled].sort()).toEqual(items);
  });

  it('swaps each position with one chosen by the random source', () => {
    // random() = 0 always picks index 0: each item is swapped to the front.
    expect(new FisherYatesShuffler(() => 0).shuffle(items)).toEqual([
      'b',
      'c',
      'd',
      'e',
      'a',
    ]);
    // random() just below 1 always picks the current index: no swaps.
    expect(new FisherYatesShuffler(() => 0.9999).shuffle(items)).toEqual(items);
  });

  it('can produce every order of three items', () => {
    const shuffler = new FisherYatesShuffler();
    const seen = new Set<string>();

    for (let attempt = 0; attempt < 500 && seen.size < 6; attempt += 1) {
      seen.add(shuffler.shuffle(['a', 'b', 'c']).join(''));
    }

    expect(seen.size).toBe(6);
  });
});
