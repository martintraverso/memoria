import { GameStateSnapshot } from '../core/services/rooms-api.service';

type Handler = (payload: unknown) => void;

/** In-memory stand-in for `SocketService`: records emits, lets tests push events. */
export class FakeSocketService {
  readonly emitted: { eventName: string; payload: unknown }[] = [];
  isConnected = true;
  private readonly handlers = new Map<string, Handler[]>();

  emit<T>(eventName: string, payload: T): void {
    this.emitted.push({ eventName, payload });
  }

  on<T>(eventName: string, handler: (payload: T) => void): void {
    const list = this.handlers.get(eventName) ?? [];
    list.push(handler as Handler);
    this.handlers.set(eventName, list);
  }

  off<T>(eventName: string, handler?: (payload: T) => void): void {
    if (!handler) {
      this.handlers.delete(eventName);
      return;
    }
    const list = (this.handlers.get(eventName) ?? []).filter((item) => item !== handler);
    this.handlers.set(eventName, list);
  }

  disconnect(): void {}

  /** Delivers a server event to the registered handlers. */
  receive(eventName: string, payload?: unknown): void {
    for (const handler of this.handlers.get(eventName) ?? []) {
      handler(payload);
    }
  }

  listenerCount(eventName: string): number {
    return this.handlers.get(eventName)?.length ?? 0;
  }

  emittedNames(): string[] {
    return this.emitted.map((item) => item.eventName);
  }
}

/** A finished 2x2 match between Ana (`ana`) and Beto (`beto`). */
export function finishedState(overrides: Partial<GameStateSnapshot> = {}): GameStateSnapshot {
  return {
    roomCode: 'ABC234',
    boardSize: 2,
    status: 'finished',
    players: [
      { id: 'ana', name: 'Ana' },
      { id: 'beto', name: 'Beto' },
    ],
    turnPlayerId: null,
    cards: [
      { id: 'c1', value: 'img-1', state: 'matched' },
      { id: 'c2', value: 'img-1', state: 'matched' },
      { id: 'c3', value: 'img-2', state: 'matched' },
      { id: 'c4', value: 'img-2', state: 'matched' },
    ],
    scores: [
      { playerId: 'ana', playerName: 'Ana', points: 2 },
      { playerId: 'beto', playerName: 'Beto', points: 0 },
    ],
    winnerPlayerId: 'ana',
    round: 1,
    rematchRequestedBy: [],
    ...overrides,
  };
}
