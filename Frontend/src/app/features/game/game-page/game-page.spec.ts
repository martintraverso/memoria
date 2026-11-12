import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { SocketService } from '../../../core/services/socket';
import { FakeSocketService, finishedState } from '../../../testing/fake-socket.service';
import { GamePage } from './game-page';

describe('GamePage', () => {
  let socket: FakeSocketService;
  let fixture: ComponentFixture<GamePage>;
  let navigate: ReturnType<typeof vi.spyOn>;

  /** Ana and Beto's 2x2 match in progress, Beto's turn. */
  const playingState = () =>
    finishedState({
      status: 'playing',
      turnPlayerId: 'beto',
      winnerPlayerId: null,
      cards: finishedState().cards.map((card) => ({ ...card, value: '', state: 'hidden' })),
      scores: finishedState().scores.map((score) => ({ ...score, points: 0 })),
    });

  beforeEach(async () => {
    socket = new FakeSocketService();
    await TestBed.configureTestingModule({
      imports: [GamePage],
      providers: [
        provideRouter([]),
        { provide: SocketService, useValue: socket },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ room: 'ABC234', player: 'beto', starter: '0' }),
            },
          },
        },
      ],
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(GamePage);
    fixture.detectChanges();
  });

  const element = () => fixture.nativeElement as HTMLElement;

  function receive(eventName: string, payload: unknown): void {
    socket.receive(eventName, payload);
    fixture.detectChanges();
  }

  it('renders the match while it is being played', () => {
    receive('game.state.updated', playingState());

    expect(element().querySelector('.turn-banner')?.textContent).toContain('Tu turno');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('goes straight to the result screen when the match finishes, without a link', () => {
    receive('game.state.updated', playingState());

    receive('game.finished', finishedState({ winnerPlayerId: null }));
    receive('game.state.updated', finishedState({ winnerPlayerId: null }));

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/result'], {
      queryParams: { room: 'ABC234', player: 'beto' },
      replaceUrl: true,
    });
    expect(element().textContent).not.toContain('Ver resultado final');
  });

  it('goes to the result screen when it opens on a match that already finished', () => {
    receive('game.state.updated', finishedState());

    expect(navigate).toHaveBeenCalledWith(['/result'], {
      queryParams: { room: 'ABC234', player: 'beto' },
      replaceUrl: true,
    });
  });
});
