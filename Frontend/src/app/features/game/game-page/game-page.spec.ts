import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { SocketService } from '../../../core/services/socket';
import { FakeSocketService, finishedState } from '../../../testing/fake-socket.service';
import { GamePage } from './game-page';

describe('GamePage', () => {
  let socket: FakeSocketService;
  let fixture: ComponentFixture<GamePage>;

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
    fixture = TestBed.createComponent(GamePage);
    fixture.detectChanges();
  });

  const element = () => fixture.nativeElement as HTMLElement;

  function receive(eventName: string, payload: unknown): void {
    socket.receive(eventName, payload);
    fixture.detectChanges();
  }

  it('links to the result screen with the room and player, not the winner', () => {
    receive('game.finished', finishedState({ winnerPlayerId: null }));

    const link = element().querySelector<HTMLAnchorElement>('.result-banner a');
    const url = new URL(link?.href ?? '', 'http://localhost');
    expect(url.pathname).toBe('/result');
    expect(url.searchParams.get('room')).toBe('ABC234');
    expect(url.searchParams.get('player')).toBe('beto');
    expect(url.searchParams.has('winner')).toBe(false);
    expect(element().textContent).toContain('Empate');
  });

  it('tells the player that the rival wants a rematch', () => {
    receive('game.rematch.requested', finishedState({ rematchRequestedBy: ['ana'] }));

    expect(element().textContent).toContain('Ana quiere la revancha');
  });

  it('does not show the notice for the player’s own request', () => {
    receive('game.rematch.requested', finishedState({ rematchRequestedBy: ['beto'] }));

    expect(element().textContent).not.toContain('quiere la revancha');
  });

  it('renders the new round when the rematch starts', () => {
    receive('game.finished', finishedState());

    receive(
      'game.started',
      finishedState({
        status: 'playing',
        turnPlayerId: 'beto',
        winnerPlayerId: null,
        round: 2,
        cards: finishedState().cards.map((card) => ({ ...card, value: '', state: 'hidden' })),
        scores: finishedState().scores.map((score) => ({ ...score, points: 0 })),
      }),
    );

    expect(element().querySelector('.result-banner')).toBeNull();
    expect(element().querySelector('.turn-banner')?.textContent).toContain('Tu turno');
  });
});
