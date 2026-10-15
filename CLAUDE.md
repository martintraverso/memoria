# CLAUDE.md

Memoria 1v1: a real-time, two-player online memory (pairs) game. One player creates a room and shares its 6-character code; the second joins with it. The creator picks the board size and starts the match. Players take turns flipping two cards: a match scores 1 point, and a mismatch hides the cards again after 1s. The game ends when every pair has been found.

The repo holds two independent npm projects (no workspace or root `package.json`). Both are **TypeScript**:

- `Backend/`: NestJS 11, Socket.IO, SQLite (`better-sqlite3`), Jest
- `Frontend/`: Angular 22 (standalone components, zoneless), socket.io-client, Vitest

`docs/plan.md` (Spanish) is the product plan and progress log. Update its "Estado de avance" section when you finish a feature phase.

## Commands

Run each from its own folder. Install with `npm install` in each folder.

| | Backend (`cd Backend`) | Frontend (`cd Frontend`) |
|---|---|---|
| Dev server | `npm run start:dev` → http://localhost:3000 (REST under `/api`) | `npm start` → http://localhost:4200 |
| Unit tests | `npm test` (Jest, `src/**/*.spec.ts`) | `npm test` (`ng test`, Vitest + jsdom) |
| Single test | `npx jest src/game/domain/game.spec.ts -t "mismatch"` | `npx ng test --include src/app/app.spec.ts` |
| E2E | `npm run test:e2e` | none |
| Lint/format | `npm run lint` (eslint --fix), `npm run format` | prettier only (no lint script) |
| Build | `npm run build` → `dist/` | `npm run build` |

To test a match by hand, run both servers, then open the app in one normal window and one incognito window.

## Architecture

### The server is authoritative
All game rules live in the `Game` domain model (`Backend/src/game/domain/game.ts`): who can start, turn validation, flipping, matching, scoring and the winner. The frontend only renders state and sends intents. Never move rule checks to the client. `toPublicGameState()` (`game/domain/public-game-state.ts`) hides the `value` of hidden cards so clients can't cheat. Keep that guarantee for any new field you add.

### Backend uses hexagonal architecture (mandatory)
**Every** code change in `Backend/` must follow hexagonal architecture (Ports & Adapters). Before you write or refactor any backend code, invoke the `hexagonal-architecture` skill and follow its guidance. No backend change is exempt, including small fixes.
- The domain (entities, rules, game engine) has no imports from NestJS, Socket.IO, `better-sqlite3` or other infrastructure.
- Use cases (application layer) orchestrate the domain and depend only on **ports**, which are interfaces they define (for example, a game snapshot repository).
- Adapters implement or drive ports. Driving adapters are REST controllers and the Socket.IO gateway. Driven adapters are SQLite persistence, timers and the clock. Wire adapters to ports through Nest providers and injection tokens.
- Dependencies point inward only: adapters → application → domain.
- Unit-test the domain and use cases without Nest or a database. Use in-memory fakes for ports.
- `npm run lint` enforces the layer boundaries (`no-restricted-imports` in `eslint.config.mjs`). `domain/` can't import frameworks, Node built-ins, `application/` or `adapters/`. `application/` can't import frameworks, Node built-ins or `adapters/`. The one exception: `application/**/*.spec.ts` may import the in-memory adapters as port fakes.

### Backend modules (`Backend/src`)
- `shared/`: code both features use. `domain/` holds `DomainError` and its subclasses, plus `RoomCode`, the identifier shared by a room and its game. `application/ports/` holds `IdGenerator`. `adapters/` holds `CryptoIdGenerator` and the HTTP and WS filters that map domain errors to the protocol. `SharedModule` provides `ID_GENERATOR`.
- `rooms/`: `domain/` (`Room`, `PlayerName`), `application/` (`CreateRoomUseCase`, `JoinRoomUseCase`, `GetRoomUseCase`, ports `RoomRepository` and `RoomCodeGenerator`), `adapters/` (REST `RoomsController`, `SqliteRoomRepository`, `InMemoryRoomRepository`, `RandomRoomCodeGenerator`), wired in `rooms.module.ts`. A room's status is `lobby` (1 player) or `ready` (2 players). The creator is always `players[0]`. Room codes use the characters `A-Z` minus I/O, plus `2-9`. `RoomCode.parse()` normalizes them with `trim().toUpperCase()` but doesn't validate the format (an unknown code is a 404).
- `game/`: `domain/` holds the immutable `Game` model (each move returns a new `Game`; `toSnapshot()` is the stored JSON shape), `BoardSize`, `buildBoard()` and `toPublicGameState()`. `application/` holds `StartGameUseCase`, `FlipCardUseCase`, `ResolveMismatchUseCase` and `GetGameStateUseCase`, plus the ports `GameRepository`, `RoomLookup` and `Shuffler`. `adapters/` holds `GameGateway` (Socket.IO namespace `/game`), `GameController` (`GET /api/games/:roomCode`), `SqliteGameRepository`, `InMemoryGameRepository`, `FisherYatesShuffler` and `RoomsRoomLookup`, the only file in `game/` (besides `game.module.ts`) that knows the rooms feature. It is wired in `game.module.ts`.
- `persistence/`: a global `PersistenceModule` that provides one `better-sqlite3` connection under the `SQLITE_DATABASE` token (`sqlite-database.ts`) and closes it in `onApplicationShutdown`. It knows no feature. Each SQLite repository owns its table (it creates the table in its constructor) and its SQL: `SqliteRoomRepository` stores whole JSON snapshots in `room_snapshots`, `SqliteGameRepository` in `game_snapshots`. Both are write-through caches, loaded in `onModuleInit`, and use cases call `save()` after every change. Unit tests build use cases with in-memory adapters (`InMemoryRoomRepository`, `InMemoryGameRepository`) and no persistence. Each repository pair shares a `*.contract-spec.ts` suite.
- `main.ts`: global prefix `api`, CORS for `FRONTEND_URL`.

### Board rules
Board sizes are `2|3|4|5`, which means N×N grids. Card values are `img-1…img-k`. Odd grids (3×3, 5×5) get one unplayable `blocked` card. The card states are `hidden | revealed | matched | blocked`.

### Real-time protocol (Socket.IO, namespace `/game`)
Each room code is also a Socket.IO room.
- Client → server: `room.subscribe`, `game.start.request {roomCode, playerId, boardSize}`, `card.flip.request {roomCode, playerId, cardId}`, `game.state.request`, `game.ping`
- Server → room: `game.started`, `game.state.updated` (always sent; it carries the full state), `card.flip.applied`, `score.updated`, `turn.changed`, `cards.hidden`, `game.finished`
- Room broadcasts come from the use cases, through the `GameEvents` port, in a fixed order that clients rely on. `SocketIoGameEvents` maps each port method to its event name. `GameGateway` only parses payloads, manages socket room membership and replies to the requester. It joins the requester to the room *before* `StartGameUseCase` broadcasts, and removes it again if the start is rejected.
- The 1s mismatch delay (`MISMATCH_REVEAL_MS`) is scheduled by `FlipCardUseCase` through the `MismatchScheduler` port. `TimeoutMismatchScheduler` runs it, cancels pending timers on shutdown, and logs a failing task instead of crashing.

If you add or rename an event, update the `GameEvents` port, `SocketIoGameEvents` (for server → room events) or `GameGateway` (for client → server events), and the `socketEvents` list in `Frontend/src/app/features/game/game-page/game-page.ts`. `test/game.e2e-spec.ts` pins the exact event sequences.

### Frontend (`Frontend/src/app`)
- `core/config/runtime-config.ts`: hard-coded API and WS base URLs. There are no Angular environments files.
- `core/services/rooms-api.service.ts`: REST client. It **duplicates** the backend types (`RoomSnapshot`, `GameStateSnapshot`) by hand, so keep both sides in sync when you change a shape.
- `core/services/socket.ts`: a thin, root-singleton wrapper around a socket.io-client socket.
- `features/{home,lobby,game,result}/<name>-page/`: one standalone component per route.
- Session identity has no auth or storage. `room`, `player` (playerId), `size` and `starter` travel as **query params** between routes, and reconnecting means re-sending `game.state.request`.
- The app is zoneless (no zone.js). After socket callbacks mutate component state, components call `ChangeDetectorRef.detectChanges()`. Do the same in new async handlers, or use signals.

## Conventions

- User-facing strings and server exception messages are in **Spanish**. Code identifiers are in English.
- Backend: Nest exceptions (`BadRequestException`, `ConflictException`, `NotFoundException`) for rule violations. Use single quotes and trailing commas (Prettier).
- Frontend: Prettier with `printWidth: 100` and single quotes. Components use separate `.html`/`.scss` files.
- Environment variables (backend): `PORT` (3000), `FRONTEND_URL` (`http://localhost:4200`, used for CORS on both REST and WS), `DATABASE_PATH` (`data/memoria.sqlite`, relative to `Backend/`, gitignored).
- To reset local state, delete `Backend/data/memoria.sqlite`. Snapshots reload on startup, so old rooms survive restarts.
