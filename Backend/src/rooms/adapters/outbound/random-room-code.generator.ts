import type { RoomCodeGenerator } from '../../application/ports/outbound/room-code-generator.port';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  RoomCode,
} from '../../../shared/domain/room-code';

export class RandomRoomCodeGenerator implements RoomCodeGenerator {
  constructor(private readonly random: () => number = Math.random) {}

  generate(): RoomCode {
    const characters = Array.from({ length: ROOM_CODE_LENGTH }, () => {
      const index = Math.floor(this.random() * ROOM_CODE_ALPHABET.length);
      return ROOM_CODE_ALPHABET[index];
    });
    return RoomCode.parse(characters.join(''));
  }
}
