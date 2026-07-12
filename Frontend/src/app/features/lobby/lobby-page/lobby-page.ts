import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import {
  GameStateSnapshot,
  RoomsApiService,
  RoomSnapshot,
} from '../../../core/services/rooms-api.service';

@Component({
  selector: 'app-lobby-page',
  imports: [FormsModule],
  templateUrl: './lobby-page.html',
  styleUrl: './lobby-page.scss',
})
export class LobbyPage implements OnDestroy {
  createPlayerName = '';
  joinPlayerName = '';
  joinRoomCode = '';
  selectedBoardSize = 4;
  room: RoomSnapshot | null = null;
  currentPlayerId: string | null = null;
  isLoading = false;
  errorMessage = '';
  copiedCode = false;
  private poller: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly roomsApiService: RoomsApiService,
    private readonly router: Router,
    private readonly changeDetectorRef: ChangeDetectorRef,
  ) {}

  ngOnDestroy(): void {
    this.stopPolling();
  }

  createRoom(): void {
    this.errorMessage = '';
    this.isLoading = true;
    this.roomsApiService
      .createRoom(this.createPlayerName)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.triggerViewUpdate();
        }),
      )
      .subscribe({
        next: ({ room, playerId }) => {
          this.room = room;
          this.currentPlayerId = playerId;
          this.copiedCode = false;
          this.createPlayerName = '';
          this.startPolling();
          this.triggerViewUpdate();
        },
        error: (error: { error?: { message?: string } }) => {
          this.errorMessage = this.extractErrorMessage(error);
          this.triggerViewUpdate();
        },
      });
  }

  joinRoom(): void {
    this.errorMessage = '';
    this.isLoading = true;
    this.roomsApiService
      .joinRoom(this.joinRoomCode, this.joinPlayerName)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.triggerViewUpdate();
        }),
      )
      .subscribe({
        next: ({ room, playerId }) => {
          this.room = room;
          this.currentPlayerId = playerId;
          this.copiedCode = false;
          this.joinPlayerName = '';
          this.joinRoomCode = '';
          this.startPolling();
          this.triggerViewUpdate();
        },
        error: (error: { error?: { message?: string } }) => {
          this.errorMessage = this.extractErrorMessage(error);
          this.triggerViewUpdate();
        },
      });
  }

  refreshRoom(): void {
    if (!this.room) {
      return;
    }
    this.roomsApiService.getRoom(this.room.code).subscribe({
      next: (room) => {
        this.room = room;
        this.tryAutoEnterGameForGuest();
        this.triggerViewUpdate();
      },
      error: (error: { error?: { message?: string } }) => {
        this.errorMessage = this.extractErrorMessage(error);
        this.triggerViewUpdate();
      },
    });
  }

  goToGame(): void {
    if (
      !this.room ||
      this.room.status !== 'ready' ||
      !this.currentPlayerId ||
      !this.isRoomCreator
    ) {
      this.errorMessage = 'La sala aún no está lista para iniciar.';
      return;
    }

    this.router.navigate(['/game'], {
      queryParams: {
        room: this.room.code,
        player: this.currentPlayerId,
        size: this.selectedBoardSize,
        starter: '1',
      },
    });
  }

  get isRoomCreator(): boolean {
    if (!this.room || !this.currentPlayerId) {
      return false;
    }

    return this.room.players[0]?.id === this.currentPlayerId;
  }

  get waitingHostStart(): boolean {
    return !!this.room && this.room.status === 'ready' && !this.isRoomCreator;
  }

  get guestConnected(): boolean {
    return !!this.room && this.room.players.length === 2;
  }

  get startDisabled(): boolean {
    return !this.room || this.room.status !== 'ready' || !this.isRoomCreator;
  }

  get startButtonLabel(): string {
    return this.guestConnected ? 'Iniciar partida' : 'Esperando rival…';
  }

  async copyRoomCode(): Promise<void> {
    if (!this.room?.code || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(this.room.code);
      this.copiedCode = true;
      this.triggerViewUpdate();
    } catch {
      this.errorMessage = 'No se pudo copiar el código al portapapeles.';
      this.triggerViewUpdate();
    }
  }

  private startPolling(): void {
    this.stopPolling();
    this.poller = setInterval(() => this.refreshRoom(), 2000);
  }

  private stopPolling(): void {
    if (!this.poller) {
      return;
    }
    clearInterval(this.poller);
    this.poller = null;
  }

  private extractErrorMessage(error: { error?: { message?: string } }): string {
    const backendMessage = error.error?.message;
    if (backendMessage) {
      return backendMessage;
    }

    return 'No se pudo completar la operación de lobby.';
  }

  private triggerViewUpdate(): void {
    this.changeDetectorRef.detectChanges();
  }

  private tryAutoEnterGameForGuest(): void {
    if (!this.room || !this.currentPlayerId || this.isRoomCreator) {
      return;
    }

    if (this.room.status !== 'ready') {
      return;
    }

    this.roomsApiService.getGameState(this.room.code).subscribe({
      next: (gameState: GameStateSnapshot) => {
        this.stopPolling();
        this.router.navigate(['/game'], {
          queryParams: {
            room: this.room?.code,
            player: this.currentPlayerId,
            size: gameState.boardSize,
            starter: '0',
          },
        });
      },
      error: () => {
        // Host has not started yet; continue polling.
      },
    });
  }
}
