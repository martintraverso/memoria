import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { runtimeConfig } from '../config/runtime-config';

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

export interface RoomActionResponse {
  room: RoomSnapshot;
  playerId: string;
}

export interface GameCard {
  id: string;
  value: string;
  state: 'hidden' | 'revealed' | 'matched' | 'blocked';
}

export interface GameScore {
  playerId: string;
  playerName: string;
  points: number;
}

/** Mirrors the backend's `PublicGameState`. Keep both in sync. */
export interface GameStateSnapshot {
  roomCode: string;
  boardSize: number;
  status: 'playing' | 'finished';
  players: { id: string; name: string }[];
  turnPlayerId: string | null;
  cards: GameCard[];
  scores: GameScore[];
  winnerPlayerId: string | null;
  /** 1 for the room's first match, +1 for each rematch. */
  round: number;
  /** Players who asked for a rematch of the finished match. */
  rematchRequestedBy: string[];
}

@Injectable({ providedIn: 'root' })
export class RoomsApiService {
  constructor(private readonly http: HttpClient) {}

  createRoom(playerName: string): Observable<RoomActionResponse> {
    return this.http.post<RoomActionResponse>(`${runtimeConfig.apiBaseUrl}/rooms`, {
      playerName,
    });
  }

  joinRoom(roomCode: string, playerName: string): Observable<RoomActionResponse> {
    return this.http.post<RoomActionResponse>(
      `${runtimeConfig.apiBaseUrl}/rooms/${encodeURIComponent(roomCode)}/join`,
      { playerName },
    );
  }

  getRoom(roomCode: string): Observable<RoomSnapshot> {
    return this.http.get<RoomSnapshot>(
      `${runtimeConfig.apiBaseUrl}/rooms/${encodeURIComponent(roomCode)}`,
    );
  }

  getGameState(roomCode: string): Observable<GameStateSnapshot> {
    return this.http.get<GameStateSnapshot>(
      `${runtimeConfig.apiBaseUrl}/games/${encodeURIComponent(roomCode)}`,
    );
  }
}
