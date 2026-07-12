export type RoomStatus = 'lobby' | 'ready';

export interface RoomPlayer {
  id: string;
  name: string;
}

export interface RoomSnapshot {
  code: string;
  status: RoomStatus;
  players: RoomPlayer[];
}
