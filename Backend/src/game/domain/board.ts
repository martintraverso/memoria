import type { BoardSize } from './board-size';

export type CardState = 'hidden' | 'revealed' | 'matched' | 'blocked';

export interface GameCard {
  id: string;
  value: string;
  state: CardState;
}

export const BLOCKED_CARD_VALUE = 'blocked';

/** Side effects the board needs, provided by the caller. */
export interface BoardFactoryDependencies {
  newCardId: () => string;
  shuffle: (cards: GameCard[]) => GameCard[];
}

/**
 * Builds a shuffled board: two hidden cards per value `img-1…img-k`, plus
 * one unplayable `blocked` card when the grid has an odd number of cells.
 */
export function buildBoard(
  size: BoardSize,
  { newCardId, shuffle }: BoardFactoryDependencies,
): GameCard[] {
  const cards: GameCard[] = [];

  for (let pair = 1; pair <= size.pairCount; pair += 1) {
    const value = `img-${pair}`;
    cards.push({ id: newCardId(), value, state: 'hidden' });
    cards.push({ id: newCardId(), value, state: 'hidden' });
  }

  if (size.cellCount % 2 !== 0) {
    cards.push({
      id: newCardId(),
      value: BLOCKED_CARD_VALUE,
      state: 'blocked',
    });
  }

  return shuffle(cards);
}
