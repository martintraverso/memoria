import { InvalidInputError } from '../../shared/domain/errors';

export class PlayerName {
  private constructor(readonly value: string) {}

  static parse(raw: string | null | undefined): PlayerName {
    const value = raw?.trim();
    if (!value) {
      throw new InvalidInputError('El nombre del jugador es obligatorio.');
    }
    return new PlayerName(value);
  }
}
