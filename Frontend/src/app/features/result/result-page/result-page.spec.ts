import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { SocketService } from '../../../core/services/socket';
import { FakeSocketService, finishedState } from '../../../testing/fake-socket.service';
import { ResultPage } from './result-page';

describe('ResultPage', () => {
  let socket: FakeSocketService;
  let fixture: ComponentFixture<ResultPage>;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function open(params: Record<string, string>): Promise<void> {
    socket = new FakeSocketService();
    await TestBed.configureTestingModule({
      imports: [ResultPage],
      providers: [
        provideRouter([]),
        { provide: SocketService, useValue: socket },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(params) } },
        },
      ],
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ResultPage);
    fixture.detectChanges();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const rematchButton = () =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.btn');

  function receive(eventName: string, payload: unknown): void {
    socket.receive(eventName, payload);
    fixture.detectChanges();
  }

  it('asks for the game state and shows a loading message until it arrives', async () => {
    await open({ room: 'abc234', player: 'ana' });

    expect(socket.emitted).toEqual([
      { eventName: 'room.subscribe', payload: { roomCode: 'ABC234' } },
      { eventName: 'game.state.request', payload: { roomCode: 'ABC234' } },
    ]);
    expect(text()).toContain('Cargando resultado...');
  });

  it('shows an error without a room code', async () => {
    await open({});

    expect(text()).toContain('Faltan datos de sala para mostrar el resultado.');
    expect(socket.emitted).toEqual([]);
  });

  it.each([
    ['ana', '🏆', '¡Ganaste!', 'Vos 2 – 0 Beto'],
    ['beto', '😔', 'Perdiste', 'Vos 0 – 2 Ana'],
  ])('personalizes the result for %s', async (player, emoji, title, score) => {
    await open({ room: 'ABC234', player });

    receive('game.state.updated', finishedState());

    expect(text()).toContain(emoji);
    expect(text()).toContain(title);
    expect(text()).toContain(score);
    expect(text()).toContain('Sala: ABC234');
  });

  it('shows a draw with the final score', async () => {
    await open({ room: 'ABC234', player: 'beto' });

    receive(
      'game.state.updated',
      finishedState({
        winnerPlayerId: null,
        scores: [
          { playerId: 'ana', playerName: 'Ana', points: 1 },
          { playerId: 'beto', playerName: 'Beto', points: 1 },
        ],
      }),
    );

    expect(text()).toContain('🤝');
    expect(text()).toContain('Empate');
    expect(text()).not.toContain('Ganó');
    expect(text()).toContain('Vos 1 – 1 Ana');
  });

  it('shows the neutral result, without rematch, when the player is unknown', async () => {
    await open({ room: 'ABC234' });

    receive('game.state.updated', finishedState());

    expect(text()).toContain('🏆');
    expect(text()).toContain('Ganó Ana');
    expect(text()).toContain('Ana 2 – 0 Beto');
    expect(rematchButton()).toBeNull();
  });

  it('navigates to the game when the match is being played', async () => {
    await open({ room: 'ABC234', player: 'beto' });

    receive('game.started', finishedState({ status: 'playing', turnPlayerId: 'beto', round: 2 }));

    expect(navigate).toHaveBeenCalledWith(['/game'], {
      queryParams: { room: 'ABC234', player: 'beto', size: 2, starter: '0' },
    });
  });

  describe('rematch', () => {
    it('asks for a rematch and waits for the rival', async () => {
      await open({ room: 'ABC234', player: 'ana' });
      receive('game.state.updated', finishedState());
      expect(rematchButton()?.textContent?.trim()).toBe('Revancha');

      rematchButton()?.click();
      fixture.detectChanges();

      expect(socket.emitted.at(-1)).toEqual({
        eventName: 'game.rematch.request',
        payload: { roomCode: 'ABC234', playerId: 'ana' },
      });
      expect(rematchButton()?.disabled).toBe(true);
      expect(rematchButton()?.textContent?.trim()).toBe('Esperando a Beto…');

      receive('game.rematch.requested', finishedState({ rematchRequestedBy: ['ana'] }));
      expect(rematchButton()?.disabled).toBe(true);
      expect(rematchButton()?.textContent?.trim()).toBe('Esperando a Beto…');
    });

    it('offers to accept when the rival asked first', async () => {
      await open({ room: 'ABC234', player: 'beto' });

      receive('game.rematch.requested', finishedState({ rematchRequestedBy: ['ana'] }));

      expect(text()).toContain('Ana quiere la revancha');
      expect(rematchButton()?.disabled).toBe(false);
      expect(rematchButton()?.textContent?.trim()).toBe('Aceptar revancha');
    });

    it('shows an error when the server rejects the request', async () => {
      await open({ room: 'ABC234', player: 'ana' });
      receive('game.state.updated', finishedState());
      rematchButton()?.click();

      receive('exception', {
        message: 'Internal server error',
        cause: { pattern: 'game.rematch.request' },
      });

      expect(text()).toContain('No se pudo pedir la revancha.');
      expect(rematchButton()?.disabled).toBe(false);
    });

    it('prefers a specific server message and ignores other exceptions', async () => {
      await open({ room: 'ABC234', player: 'ana' });
      receive('game.state.updated', finishedState());

      receive('exception', { message: 'Otro error', cause: { pattern: 'game.state.request' } });
      expect(text()).not.toContain('Otro error');

      receive('exception', {
        message: 'La partida todavía no terminó.',
        cause: { pattern: 'game.rematch.request' },
      });
      expect(text()).toContain('La partida todavía no terminó.');
    });
  });

  it('removes only its own listeners when destroyed', async () => {
    await open({ room: 'ABC234', player: 'ana' });
    const other = () => undefined;
    socket.on('game.state.updated', other);

    fixture.destroy();

    expect(socket.listenerCount('game.state.updated')).toBe(1);
    expect(socket.listenerCount('exception')).toBe(0);
    expect(socket.listenerCount('connect')).toBe(0);
  });
});
