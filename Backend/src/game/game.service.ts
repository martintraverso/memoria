import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RoomsService } from '../rooms/rooms.service';
import { SQLitePersistenceService } from '../persistence/sqlite-persistence.service';
import {
  FlipResult,
  GameCard,
  GamePlayerScore,
  GameState,
  GameStatus,
} from './game.types';

@Injectable()
export class GameService implements OnModuleInit {
  private readonly games = new Map<string, InternalGameState>();
  private readonly allowedBoardSizes = new Set([2, 3, 4, 5]);

  constructor(
    private readonly roomsService: RoomsService,
    @Optional()
    private readonly persistenceService?: SQLitePersistenceService,
  ) {}

  onModuleInit(): void {
    if (!this.persistenceService) {
      return;
    }

    for (const game of this.persistenceService.loadGames<InternalGameState>()) {
      this.games.set(game.roomCode, game);
    }
  }

  startGame(roomCode: string, playerId: string, boardSize: number): GameState {
    const room = this.roomsService.getRoom(roomCode);
    const normalizedRoomCode = room.code;

    if (room.players.length !== 2 || room.status !== 'ready') {
      throw new ConflictException('La sala aún no tiene 2 jugadores listos.');
    }

    this.ensurePlayerInRoom(
      playerId,
      room.players.map((player) => player.id),
    );
    this.ensurePlayerIsRoomCreator(playerId, room.players[0]?.id ?? '');
    this.ensureBoardSize(boardSize);

    const existingGame = this.games.get(normalizedRoomCode);
    if (existingGame) {
      return this.toPublicState(existingGame);
    }

    const cards = this.buildBoard(boardSize);
    const game: InternalGameState = {
      roomCode: normalizedRoomCode,
      boardSize,
      status: 'playing',
      players: room.players.map((player) => ({ ...player })),
      turnPlayerId: room.players[0].id,
      cards,
      openedCardIds: [],
      scores: room.players.map((player) => ({
        playerId: player.id,
        playerName: player.name,
        points: 0,
      })),
      winnerPlayerId: null,
      totalMatchablePairs: Math.floor((boardSize * boardSize) / 2),
      matchedPairs: 0,
    };

    this.games.set(normalizedRoomCode, game);
    this.persistGame(game);
    return this.toPublicState(game);
  }

  getGameState(roomCode: string): GameState {
    const game = this.getGameByRoomCode(roomCode);
    return this.toPublicState(game);
  }

  hasGame(roomCode: string): boolean {
    const normalizedCode = roomCode?.trim().toUpperCase();
    if (!normalizedCode) {
      return false;
    }
    return this.games.has(normalizedCode);
  }

  flipCard(roomCode: string, playerId: string, cardId: string): FlipResult {
    const game = this.getGameByRoomCode(roomCode);
    this.ensureGameActive(game);
    this.ensurePlayerInRoom(
      playerId,
      game.players.map((player) => player.id),
    );

    if (game.turnPlayerId !== playerId) {
      throw new ConflictException('No es el turno del jugador.');
    }

    if (game.openedCardIds.length >= 2) {
      throw new ConflictException(
        'Hay una jugada pendiente de resolución. Espera un momento.',
      );
    }

    const card = game.cards.find((item) => item.id === cardId);
    if (!card) {
      throw new NotFoundException('La carta no existe.');
    }

    if (card.state !== 'hidden') {
      throw new ConflictException('La carta no se puede levantar.');
    }

    card.state = 'revealed';
    game.openedCardIds.push(card.id);

    if (game.openedCardIds.length === 1) {
      this.persistGame(game);
      return {
        state: this.toPublicState(game),
        scoreChanged: false,
        turnChanged: false,
        finished: false,
        mismatchPending: false,
      };
    }

    const [firstCardId, secondCardId] = game.openedCardIds;
    const firstCard = game.cards.find((item) => item.id === firstCardId);
    const secondCard = game.cards.find((item) => item.id === secondCardId);

    if (!firstCard || !secondCard) {
      throw new NotFoundException(
        'No se pudieron resolver las cartas levantadas.',
      );
    }

    if (firstCard.value === secondCard.value) {
      firstCard.state = 'matched';
      secondCard.state = 'matched';
      game.openedCardIds = [];
      game.matchedPairs += 1;
      this.addPointToPlayer(game, playerId);
      this.completeOrAdvanceTurn(game);
      this.persistGame(game);

      return {
        state: this.toPublicState(game),
        scoreChanged: true,
        turnChanged: game.status === 'playing',
        finished: game.status === 'finished',
        mismatchPending: false,
      };
    }

    this.persistGame(game);
    return {
      state: this.toPublicState(game),
      scoreChanged: false,
      turnChanged: false,
      finished: false,
      mismatchPending: true,
    };
  }

  resolveMismatch(roomCode: string): GameState | null {
    const game = this.findGameByRoomCode(roomCode);
    if (!game) {
      return null;
    }

    if (game.openedCardIds.length !== 2 || game.status !== 'playing') {
      return null;
    }

    for (const openedCardId of game.openedCardIds) {
      const card = game.cards.find((item) => item.id === openedCardId);
      if (!card || card.state !== 'revealed') {
        continue;
      }
      card.state = 'hidden';
    }

    game.openedCardIds = [];
    this.advanceTurn(game);
    this.persistGame(game);

    return this.toPublicState(game);
  }

  private addPointToPlayer(game: InternalGameState, playerId: string): void {
    const score = game.scores.find((item) => item.playerId === playerId);
    if (!score) {
      throw new NotFoundException('No se encontró score del jugador.');
    }
    score.points += 1;
  }

  private completeOrAdvanceTurn(game: InternalGameState): void {
    if (game.matchedPairs >= game.totalMatchablePairs) {
      game.status = 'finished';
      game.turnPlayerId = null;
      game.winnerPlayerId = this.resolveWinner(game.scores);
      return;
    }

    this.advanceTurn(game);
  }

  private resolveWinner(scores: GamePlayerScore[]): string | null {
    const [first, second] = scores;
    if (!first || !second || first.points === second.points) {
      return null;
    }
    return first.points > second.points ? first.playerId : second.playerId;
  }

  private advanceTurn(game: InternalGameState): void {
    const currentTurnIndex = game.players.findIndex(
      (player) => player.id === game.turnPlayerId,
    );
    if (currentTurnIndex < 0) {
      throw new NotFoundException('No se encontró el turno actual.');
    }

    const nextPlayerIndex = (currentTurnIndex + 1) % game.players.length;
    game.turnPlayerId = game.players[nextPlayerIndex].id;
  }

  private ensureBoardSize(boardSize: number): void {
    if (
      !Number.isInteger(boardSize) ||
      !this.allowedBoardSizes.has(boardSize)
    ) {
      throw new BadRequestException(
        'El tamaño del tablero debe ser 2, 3, 4 o 5.',
      );
    }
  }

  private ensurePlayerInRoom(playerId: string, playerIds: string[]): void {
    if (!playerId || !playerIds.includes(playerId)) {
      throw new BadRequestException('El jugador no pertenece a la sala.');
    }
  }

  private ensurePlayerIsRoomCreator(
    playerId: string,
    roomCreatorId: string,
  ): void {
    if (playerId !== roomCreatorId) {
      throw new ConflictException(
        'Solo el jugador que creó la sala puede iniciar la partida.',
      );
    }
  }

  private ensureGameActive(game: InternalGameState): void {
    if (game.status !== 'playing') {
      throw new ConflictException('La partida ya finalizó.');
    }
  }

  private getGameByRoomCode(roomCode: string): InternalGameState {
    const normalizedCode = this.normalizeRoomCode(roomCode);
    const game = this.games.get(normalizedCode);
    if (!game) {
      throw new NotFoundException('No hay partida activa para esta sala.');
    }
    return game;
  }

  private findGameByRoomCode(roomCode: string): InternalGameState | null {
    const normalizedCode = this.normalizeRoomCode(roomCode);
    return this.games.get(normalizedCode) ?? null;
  }

  private normalizeRoomCode(roomCode: string): string {
    const normalizedCode = roomCode?.trim().toUpperCase();
    if (!normalizedCode) {
      throw new BadRequestException('El código de sala es obligatorio.');
    }
    return normalizedCode;
  }

  private buildBoard(boardSize: number): GameCard[] {
    const totalCells = boardSize * boardSize;
    const totalPairs = Math.floor(totalCells / 2);
    const cards: GameCard[] = [];

    for (let index = 1; index <= totalPairs; index += 1) {
      const value = `img-${index}`;
      cards.push({ id: randomUUID(), value, state: 'hidden' });
      cards.push({ id: randomUUID(), value, state: 'hidden' });
    }

    if (totalCells % 2 !== 0) {
      cards.push({
        id: randomUUID(),
        value: 'blocked',
        state: 'blocked',
      });
    }

    return this.shuffle(cards);
  }

  private shuffle(cards: GameCard[]): GameCard[] {
    const shuffled = [...cards];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      const temporary = shuffled[index];
      shuffled[index] = shuffled[randomIndex];
      shuffled[randomIndex] = temporary;
    }
    return shuffled;
  }

  private toPublicState(game: InternalGameState): GameState {
    return {
      roomCode: game.roomCode,
      boardSize: game.boardSize,
      status: game.status,
      players: game.players.map((player) => ({ ...player })),
      turnPlayerId: game.turnPlayerId,
      cards: game.cards.map((card) => ({
        id: card.id,
        state: card.state,
        value: card.state === 'hidden' ? '' : card.value,
      })),
      scores: game.scores.map((score) => ({ ...score })),
      winnerPlayerId: game.winnerPlayerId,
    };
  }

  private persistGame(game: InternalGameState): void {
    if (!this.persistenceService) {
      return;
    }
    this.persistenceService.saveGame(game.roomCode, game);
  }
}

interface InternalGameState {
  roomCode: string;
  boardSize: number;
  status: GameStatus;
  players: { id: string; name: string }[];
  turnPlayerId: string | null;
  cards: GameCard[];
  openedCardIds: string[];
  scores: GamePlayerScore[];
  winnerPlayerId: string | null;
  totalMatchablePairs: number;
  matchedPairs: number;
}
