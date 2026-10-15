import { InvalidInputError } from './errors';
import { ROOM_CODE_ALPHABET, RoomCode } from './room-code';

describe('RoomCode', () => {
  it('trims and uppercases the input', () => {
    expect(RoomCode.parse('  ab3kq9 ').value).toBe('AB3KQ9');
  });

  it.each([undefined, null, '', '   '])(
    'rejects %p as a missing code',
    (raw) => {
      expect(() => RoomCode.parse(raw)).toThrow(
        new InvalidInputError('El código de sala es obligatorio.'),
      );
    },
  );

  it('does not validate the format, so unknown codes end up as "not found"', () => {
    expect(RoomCode.parse('io-1').value).toBe('IO-1');
  });

  it('uses A-Z without I and O, plus 2-9', () => {
    expect(ROOM_CODE_ALPHABET).toBe('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
  });
});
