import { InvalidInputError } from '../../shared/domain/errors';

export const BOARD_SIZES = [2, 3, 4, 5] as const;

export type BoardSizeValue = (typeof BOARD_SIZES)[number];

/** Side of the square grid: a size of 4 is a 4×4 board. */
export class BoardSize {
  private constructor(readonly value: BoardSizeValue) {}

  static parse(raw: number): BoardSize {
    if (!BOARD_SIZES.some((size) => size === raw)) {
      throw new InvalidInputError(
        'El tamaño del tablero debe ser 2, 3, 4 o 5.',
      );
    }
    return new BoardSize(raw as BoardSizeValue);
  }

  get cellCount(): number {
    return this.value * this.value;
  }

  /** Odd grids have one cell left over, filled with a blocked card. */
  get pairCount(): number {
    return Math.floor(this.cellCount / 2);
  }
}
