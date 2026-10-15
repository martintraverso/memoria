import { InvalidInputError } from '../../shared/domain/errors';
import { BoardSize } from './board-size';

describe('BoardSize', () => {
  it.each([
    [2, 4, 2],
    [3, 9, 4],
    [4, 16, 8],
    [5, 25, 12],
  ])('a size of %i has %i cells and %i pairs', (size, cells, pairs) => {
    const boardSize = BoardSize.parse(size);

    expect(boardSize.value).toBe(size);
    expect(boardSize.cellCount).toBe(cells);
    expect(boardSize.pairCount).toBe(pairs);
  });

  it.each([1, 6, 0, -4, 2.5, NaN, '4' as unknown as number])(
    'rejects %p',
    (size) => {
      expect(() => BoardSize.parse(size)).toThrow(
        new InvalidInputError('El tamaño del tablero debe ser 2, 3, 4 o 5.'),
      );
    },
  );
});
