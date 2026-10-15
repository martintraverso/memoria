import { ROOM_CODE_ALPHABET } from '../../../shared/domain/room-code';
import { RandomRoomCodeGenerator } from './random-room-code.generator';

describe('RandomRoomCodeGenerator', () => {
  it('builds 6-character codes from the room code alphabet', () => {
    const generator = new RandomRoomCodeGenerator();

    for (let attempt = 0; attempt < 200; attempt += 1) {
      const { value } = generator.generate();
      expect(value).toHaveLength(6);
      for (const character of value) {
        expect(ROOM_CODE_ALPHABET).toContain(character);
      }
    }
  });

  it('maps the random source onto the whole alphabet', () => {
    const lowest = new RandomRoomCodeGenerator(() => 0);
    const highest = new RandomRoomCodeGenerator(() => 0.9999);

    expect(lowest.generate().value).toBe('AAAAAA');
    expect(highest.generate().value).toBe('999999');
  });
});
