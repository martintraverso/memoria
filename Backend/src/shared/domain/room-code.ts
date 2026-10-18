import { InvalidInputError } from './errors';

/** Characters used for new codes: A-Z without I/O, plus 2-9. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export class RoomCode {
  private constructor(readonly value: string) {}

  /**
   * Normalizes user input (trim + uppercase). The format is not validated on
   * purpose: a well-formed but unknown code and a malformed one are both
   * "room not found" (404), not invalid input.
   */
  static parse(raw: string | null | undefined): RoomCode {
    const value = raw?.trim().toUpperCase();
    if (!value) {
      throw new InvalidInputError('El código de sala es obligatorio.');
    }
    return new RoomCode(value);
  }
}
