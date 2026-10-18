import type { Namespace } from 'socket.io';
import type { GameEvents } from '../../../application/ports/outbound/game-events.port';
import type { PublicGameState } from '../../../domain/public-game-state';
import { SocketIoGameEvents } from './socket-io-game-events';
import { SocketServerRef } from './socket-server.ref';

describe('SocketIoGameEvents', () => {
  const state = { roomCode: 'ABC234' } as PublicGameState;
  let emitted: { room: string; event: string; payload: unknown }[];
  let events: SocketIoGameEvents;

  beforeEach(() => {
    emitted = [];
    const namespace = {
      to: (room: string) => ({
        emit: (event: string, payload: unknown) => {
          emitted.push({ room, event, payload });
          return true;
        },
      }),
    } as unknown as Namespace;
    const ref = new SocketServerRef();
    ref.attach(namespace);
    events = new SocketIoGameEvents(ref);
  });

  it.each<[keyof GameEvents, string]>([
    ['gameStarted', 'game.started'],
    ['cardFlipped', 'card.flip.applied'],
    ['scoreUpdated', 'score.updated'],
    ['turnChanged', 'turn.changed'],
    ['cardsHidden', 'cards.hidden'],
    ['gameFinished', 'game.finished'],
    ['stateUpdated', 'game.state.updated'],
  ])('maps %s to the %s event in the game room', (method, eventName) => {
    events[method](state);

    expect(emitted).toEqual([
      { room: 'ABC234', event: eventName, payload: state },
    ]);
  });

  it('fails clearly when used before the gateway attached the namespace', () => {
    const detached = new SocketIoGameEvents(new SocketServerRef());

    expect(() => detached.stateUpdated(state)).toThrow(
      'The /game Socket.IO namespace is not initialized yet.',
    );
  });
});
