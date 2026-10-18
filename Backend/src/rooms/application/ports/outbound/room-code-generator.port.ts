import type { RoomCode } from '../../../../shared/domain/room-code';

/** Proposes a new code. Uniqueness is checked by the caller. */
export interface RoomCodeGenerator {
  generate(): RoomCode;
}

export const ROOM_CODE_GENERATOR = Symbol('ROOM_CODE_GENERATOR');
