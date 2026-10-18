import { buildBoard, GameCard } from './board';
import { BoardSize } from './board-size';

describe('buildBoard', () => {
  function build(size: number, shuffle = (cards: GameCard[]) => cards) {
    let next = 0;
    return buildBoard(BoardSize.parse(size), {
      newCardId: () => `card-${++next}`,
      shuffle,
    });
  }

  it('deals two hidden cards per value on even grids', () => {
    expect(build(2)).toEqual([
      { id: 'card-1', value: 'img-1', state: 'hidden' },
      { id: 'card-2', value: 'img-1', state: 'hidden' },
      { id: 'card-3', value: 'img-2', state: 'hidden' },
      { id: 'card-4', value: 'img-2', state: 'hidden' },
    ]);
  });

  it.each([3, 5])('adds one blocked card to the odd %ix%i grid', (size) => {
    const cards = build(size);
    const blocked = cards.filter((card) => card.state === 'blocked');

    expect(cards).toHaveLength(size * size);
    expect(blocked).toEqual([
      { id: `card-${size * size}`, value: 'blocked', state: 'blocked' },
    ]);
  });

  it.each([2, 3, 4, 5])(
    'uses each value img-1…img-k exactly twice on a %i board',
    (size) => {
      const counts = new Map<string, number>();
      for (const card of build(size)) {
        if (card.state !== 'blocked') {
          counts.set(card.value, (counts.get(card.value) ?? 0) + 1);
        }
      }

      const pairs = Math.floor((size * size) / 2);
      expect([...counts.keys()]).toEqual(
        Array.from({ length: pairs }, (_, index) => `img-${index + 1}`),
      );
      expect([...counts.values()].every((count) => count === 2)).toBe(true);
    },
  );

  it('returns the order chosen by the shuffle', () => {
    const cards = build(2, (dealt) => [...dealt].reverse());

    expect(cards.map((card) => card.id)).toEqual([
      'card-4',
      'card-3',
      'card-2',
      'card-1',
    ]);
  });
});
