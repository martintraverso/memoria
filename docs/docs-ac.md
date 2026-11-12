# Implementation plan: AC-6.6 (personalized result) and AC-6.7 (rematch)

**Status: implemented** (Phase 1 and Phase 2). The criteria in section 1 are now in
`docs/acceptance-criteria.md`.

This plan covers two open questions from `docs/acceptance-criteria.md`:

| AC | Decision | Scope |
|---|---|---|
| AC-6.6 Personalized result | **Do it** | Frontend only |
| AC-6.7 Rematch in the same room | **Do it** | Backend + frontend |

AC-6.6 also fixes **AC-6.5** (a draw shows "Ganó Empate"), because the result screen will work out
the outcome from the game state instead of from a `winner` query param.

The phases are ordered so each one can ship on its own: Phase 1 doesn't depend on Phase 2.

---

## 1. Acceptance criteria

These replace AC-6.4 and AC-6.5 and close the ❓ on AC-6.6 and AC-6.7 in
`docs/acceptance-criteria.md`.

### AC-6.4 Final result screen: I won
- **Given** I have more points than my rival
- **When** I open the final result screen
- **Then** I see 🏆 and "¡Ganaste!"
- **And** the final score "Vos {my points} – {rival points} {rival name}"
- **And** "Sala: {code}".

### AC-6.5 Final result screen: I lost
- **Given** my rival has more points than me
- **When** I open the final result screen
- **Then** I see 😔 and "Perdiste"
- **And** the final score and the room code, as in AC-6.4.

### AC-6.6 Final result screen: draw
- **Given** both players have the same points
- **When** I open the final result screen
- **Then** I see 🤝 and "Empate"
- **And** the final score and the room code, as in AC-6.4.

### AC-6.6b Result screen without player data
- **Given** the result screen is opened without a `player` in the URL (old link)
- **Then** it shows the neutral result: 🏆 "Ganó {winner name}" or 🤝 "Empate", plus the score.

### AC-6.7 Actions after the match
- **Given** I'm on the final result screen
- **Then** I see "Revancha", "Jugar de nuevo" (goes to `/`) and "Salir al lobby" (goes to `/lobby`).

### AC-6.8 Ask for a rematch
- **Given** the match finished and I'm on the result screen
- **When** I click "Revancha"
- **Then** the button is disabled and reads "Esperando a {rival name}…"
- **And** within ~1 second my rival sees "{my name} quiere la revancha" and their button reads
  "Aceptar revancha".

### AC-6.9 Rematch starts
- **Given** one player asked for a rematch
- **When** the other player clicks "Aceptar revancha" (or "Revancha")
- **Then** both players go to the game screen automatically
- **And** the new match uses the same room, the same players and the same board size
- **And** the scores start at 0 and every card is face down
- **And** the player who did **not** start the previous match plays first.

### AC-6.10 Rematch request before the match ends
- **Given** the match is still being played
- **Then** a rematch can't be requested: the server rejects it with
  "La partida todavía no terminó."

### AC-6.11 Rival left
- **Given** I asked for a rematch and my rival left the result screen
- **Then** I keep seeing "Esperando a {rival name}…" and can still leave with "Jugar de nuevo" or
  "Salir al lobby".
- Note: there is no presence tracking, so the app can't tell that the rival left. This is a known
  limitation, out of scope here.

### Change to AC-5.2
"The host plays first" becomes "The host plays first in the **first** match of the room. In each
rematch, the player who didn't start the previous match plays first."

---

## 2. Phase 1: Personalized result (AC-6.4 to AC-6.7), frontend only

No backend change. The result screen reads the state through the socket that already exists
(`room.subscribe` + `game.state.request`, listening to `game.state.updated`). Phase 2 needs this
same subscription to show rematch requests live, so nothing has to be rewritten later.

### 2.1 Game screen (`features/game/game-page/`)
- `game-page.html`: change the "Ver resultado final" link to
  `[queryParams]="{ room: gameState.roomCode, player: playerId }"`. Drop the `winner` param.
- `game-page.ts`: delete the `winnerName` fallback to `'Empate'` (it's only used by the old link and
  by `resultLabel`, which already handles the draw case).

### 2.2 Shared state type
- Move `GameStateView` out of `game-page.ts` and use one type for both pages. Reuse
  `GameStateSnapshot` from `core/services/rooms-api.service.ts` (tighten `cards[].state` to the
  4-state union). This leaves a single frontend copy of the backend shape to keep in sync.

### 2.3 Result screen (`features/result/result-page/`)
- Read `room` and `player` from the query params.
- Inject `SocketService` and `ChangeDetectorRef`. In `ngOnInit`, emit `room.subscribe` and
  `game.state.request`, and listen to `game.state.updated` (and `connect`, to re-request on
  reconnection, same as the game screen). Call `detectChanges()` in each handler (zoneless app).
  Remove the listeners in `ngOnDestroy`.
- While the state hasn't arrived, show "Cargando resultado...".
- If the state arrives with `status === 'playing'`, navigate to `/game` with `room`, `player`,
  `size` and `starter: '0'` (the match is still on, or a rematch already started).
- Derived getters:
  - `outcome: 'win' | 'lose' | 'draw' | 'neutral'`: `neutral` when `player` is missing or isn't
    one of `state.players`; otherwise compare `winnerPlayerId` with `player`.
  - `outcomeEmoji`: 🏆 / 😔 / 🤝 (neutral: 🏆 or 🤝).
  - `outcomeTitle`: "¡Ganaste!" / "Perdiste" / "Empate" / "Ganó {name}".
  - `myScore`, `rivalScore`, `rivalName` from `state.scores`.
- Template: emoji, title, score line "Vos {myScore} – {rivalScore} {rivalName}" (neutral:
  "{name1} {p1} – {p2} {name2}"), "Sala: {code}", then the existing action buttons.
- Errors: if `room` is missing, show "Faltan datos de sala para mostrar el resultado." and the
  action buttons.

### 2.4 Tests (Vitest, `result-page.spec.ts`, new)
Mock `SocketService` and feed a finished state:
- Win, loss and draw show the right emoji, title and score line.
- No `player` param shows the neutral result.
- A `playing` state navigates to `/game` with `starter: '0'`.
- Game page spec: the result link carries `room` and `player`, not `winner`.

### 2.5 Docs
- Update AC-6.4 to AC-6.7 in `docs/acceptance-criteria.md` with the text in section 1 and mark
  them ✅. Remove the AC-6.5 ⚠️ and the AC-6.6 ❓ from the §7 table.

---

## 3. Phase 2: Rematch (AC-6.7 to AC-6.11)

The server stays authoritative: who can ask, when, and what the new board looks like are rules in
the `Game` domain model. The frontend only sends the intent and renders state.

### 3.1 Domain (`Backend/src/game/domain/`)

**`game.ts`**
- Add to `GameSnapshot`:
  - `round: number`: 1 for the first match, +1 per rematch.
  - `startingPlayerId: string`: who played first this round.
  - `rematchRequestedBy: string[]`: player ids that asked for a rematch. Only non-empty while
    `status === 'finished'`.
- `Game.start()`: set `round: 1`, `startingPlayerId: players[0].id`, `rematchRequestedBy: []`.
- `Game.rehydrate()`: default the new fields for rows saved before this change
  (`round ?? 1`, `startingPlayerId ?? players[0].id`, `rematchRequestedBy ?? []`). This keeps old
  SQLite snapshots loading.
- New outcome type: `RematchOutcome = 'waiting' | 'started'`.
- New method `requestRematch(playerId, boardDependencies): { game: Game; outcome: RematchOutcome }`:
  1. `ensureIsPlayer(playerId, players)` (existing `InvalidInputError`).
  2. If `status !== 'finished'`: `ConflictError('La partida todavía no terminó.')`.
  3. Add `playerId` to `rematchRequestedBy` if it isn't there yet (asking twice is idempotent and
     returns `waiting` again).
  4. If only one player asked: return `waiting`.
  5. If both asked: build the next round:
     - `cards: buildBoard(BoardSize.parse(boardSize), boardDependencies)` (new ids, new shuffle)
     - `status: 'playing'`, `openedCardIds: []`, `matchedPairs: 0`, every score at 0,
       `winnerPlayerId: null`, `rematchRequestedBy: []`, `round + 1`
     - `startingPlayerId` and `turnPlayerId`: the other player (the one who didn't start the
       previous round).
     - Return `started`.
- Keep the method pure: no ids or randomness of its own, they come through `boardDependencies`,
  as in `Game.start()`.

**`public-game-state.ts`**
- Add `round` and `rematchRequestedBy` to `PublicGameState`. Neither reveals card values, so the
  anti-cheat guarantee holds. `startingPlayerId` stays private (clients don't need it).

### 3.2 Application (`Backend/src/game/application/`)

**`ports/outbound/game-events.port.ts`**
- Add `rematchRequested(state: PublicGameState): void`.

**`use-cases/request-rematch.use-case.ts`** (new)
- Constructor: `GameRepository`, `IdGenerator`, `Shuffler`, `GameEvents` (the same ports
  `StartGameUseCase` uses, minus `RoomLookup`: the game already holds its players).
- `execute({ roomCode, playerId }): RequestRematchResult { state; outcome }`:
  1. `findGameOrThrow(games, roomCode)`.
  2. `game.requestRematch(playerId, { newCardId, shuffle })`.
  3. `games.save(next)` (the repository already overwrites the row for the same room code).
  4. Broadcast, in this fixed order:
     - `waiting`: `rematchRequested` → `stateUpdated`
     - `started`: `gameStarted` → `stateUpdated` (the same sequence as a normal start, so clients
       reset the board with the code they already have)
- No mismatch timer can be pending: a finished game has no open cards.

### 3.3 Adapters (`Backend/src/game/adapters/`)

**`outbound/ws/socket-io-game-events.ts`**
- `rematchRequested()` emits `game.rematch.requested`.

**`inbound/ws/game.gateway.ts`**
- New handler `@SubscribeMessage('game.rematch.request')` with payload `{ roomCode, playerId }`:
  parse with `RoomCode.parse`, join the requester to the room (as `game.start.request` does, in
  case the result page hasn't subscribed yet), call the use case, and reply with
  `{ event: outcome === 'started' ? 'game.started' : 'game.rematch.requested', data: state }`.
- Domain errors go through `DomainErrorWsFilter`, as for the other handlers.

**`game.module.ts`**
- Register `RequestRematchUseCase` with a factory that injects `GAME_REPOSITORY`, `ID_GENERATOR`,
  `SHUFFLER` and `GAME_EVENTS`.

No persistence change: the new fields travel inside the JSON payload of `game_snapshots`.

### 3.4 Frontend

**Types**: add `round: number` and `rematchRequestedBy: string[]` to the shared game state type
(section 2.2).

**`features/game/game-page/game-page.ts`**
- Add `'game.rematch.requested'` to `socketEvents`, so a player still on the game screen keeps
  their state current.
- A new round arrives as `game.started` / `game.state.updated` with `status: 'playing'`. The board
  re-renders by itself, so a player who stayed on the game screen joins the rematch with no extra
  code.
- Finished banner: when the rival is in `rematchRequestedBy`, show "{rival} quiere la revancha"
  next to "Ver resultado final".

**`features/result/result-page/`**
- Listen to `game.rematch.requested` and `game.started` as well (both carry the full state).
- New getters: `iRequestedRematch`, `rivalRequestedRematch`.
- "Revancha" button, styled as primary:
  - Nobody asked: "Revancha", enabled.
  - I asked: "Esperando a {rival}…", disabled.
  - The rival asked: show "{rival} quiere la revancha" above it; label "Aceptar revancha".
- Click: emit `game.rematch.request { roomCode, playerId }`. Hide the button when there's no
  `player` param (neutral view).
- On a state with `status: 'playing'` (the rematch started): navigate to `/game` with `room`,
  `player`, `size: state.boardSize`, `starter: '0'`. The existing redirect from section 2.3
  already does this.
- Errors: listen to `exception` with `cause.pattern === 'game.rematch.request'` and show the
  message in red. Until the WS filter sends real messages (AC-5.10 plan, Step 1), show
  "No se pudo pedir la revancha."

**`features/game/game-page/game-page.ts`, reload after a rematch**
- A host who reloads an old `/game?...&starter=1` URL re-sends `game.start.request`.
  `StartGameUseCase` returns the current game, so it's harmless. No change needed.

### 3.5 Tests

**Domain (`game.spec.ts`)**
- Rejects a rematch while playing ("La partida todavía no terminó.") and from a non-player.
- The first request returns `waiting` and records the player; a repeat is idempotent.
- The second request returns `started` with: status `playing`, `round` + 1, new card ids, all
  cards hidden or blocked, scores at 0, `winnerPlayerId` null, `rematchRequestedBy` empty, and
  the turn on the player who didn't start the previous round.
- Two rematches in a row alternate the starter back.
- `rehydrate()` of a snapshot without the new fields fills the defaults.

**Public state (`public-game-state.spec.ts`)**
- Exposes `round` and `rematchRequestedBy`; still hides hidden card values after a rematch.

**Use case (`game-use-cases.spec.ts`)**, with in-memory fakes
- Event order for `waiting` and for `started`; the game is saved in both cases.
- Unknown room: `NotFoundError`.

**Adapters**
- `socket-io-game-events.spec.ts`: `rematchRequested` emits `game.rematch.requested` to the room.
- `game-repository.contract-spec.ts`: saving a second game for the same room code replaces the
  first one (add the case if it isn't covered).

**E2E (`test/game.e2e-spec.ts`)**
- Full flow: finish a 2x2 match, creator asks (both get `game.rematch.requested` +
  `game.state.updated`), guest asks (both get `game.started` + `game.state.updated`, `round: 2`,
  guest's turn), then a flip from the guest works.
- Rejected: rematch request while playing; only the requester gets `exception`.

**Frontend (Vitest)**
- Result page: the three button states, the emit payload, navigation on `game.started` with
  `status: 'playing'`, and the error message on `exception`.
- Game page: the "quiere la revancha" notice.

Run `npm test`, `npm run test:e2e` and `npm run lint` in `Backend/` (lint checks the layer
boundaries), and `npm test` in `Frontend/`.

### 3.6 Docs
- `docs/acceptance-criteria.md`: add AC-6.8 to AC-6.11, update AC-5.2 and AC-6.7, remove the
  rematch ❓ from §7.
- `docs/plan.md`: remove rematch from "out of scope" and add a phase to "Estado de avance".
- `CLAUDE.md`: add `game.rematch.request` (client → server) and `game.rematch.requested`
  (server → room) to the protocol section, and the new public fields.

---

## 4. Decisions taken by default

Change any of these before starting Phase 2:

| Topic | Default | Alternative |
|---|---|---|
| Who starts the rematch | The player who didn't start the previous round | Always the host; or the loser |
| Board size | Same as the previous match | Host picks a new size on the result screen |
| Agreement | Both players must ask | One click from either player restarts at once |
| Cancel a request | Not supported | `game.rematch.cancel` event |
| Rival left | Requester waits forever (no presence) | Track socket presence per room |
| Lose emoji | 😔 | Any other |
