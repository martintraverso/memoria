# Acceptance criteria – Memoria 1v1 ("Memo Duelo")

Each acceptance criterion (AC) is written as **Given / When / Then**. On-screen texts are quoted
exactly as the user sees them (in Spanish).

Status tags:

- ✅ **Implemented**: the current app already behaves this way.
- ⚠️ **Gap**: this is the expected behavior, but the current app doesn't do it yet (see "Current
  behavior").
- ❓ **To confirm**: a product decision is still open.

---

## 1. Entering the app

### AC-1.1 Welcome screen ✅
- **Given** a user opens the app at `/`
- **Then** they see the title "Memo Duelo"
- **And** the text "Memoria online 1 vs 1. Encontrá más parejas que tu rival."
- **And** a "Comenzar" button.

### AC-1.2 Go to the lobby ✅
- **Given** the user is on the welcome screen
- **When** they click "Comenzar"
- **Then** they go to `/lobby`.

### AC-1.3 Lobby: choose to create or join ✅
- **Given** the user is on `/lobby` and is not in a room yet
- **Then** they see two options:
  - **"Crear sala"**: a "Tu nombre" field and a "Crear sala" button.
  - **"Unirse con código"**: a "Tu nombre" field, a "Código de sala" field (max 6 characters)
    and an "Entrar a la sala" button.

### AC-1.4 Unknown URL ✅
- **Given** the user opens a route that doesn't exist
- **Then** they are redirected to the welcome screen (`/`).

---

## 2. Creating a room (host)

### AC-2.1 Create a room successfully ✅
- **Given** the user typed a name in "Crear sala"
- **When** they click "Crear sala"
- **Then** a room is created and the user becomes its **host**
- **And** they see "Código de sala" with a 6-character code (letters A–Z without I and O, and
  digits 2–9)
- **And** a "Copiar código" button
- **And** a player list: "Vos (host)" – "Conectado", and "Rival" – "Esperando…"
- **And** a "Tamaño del tablero" selector with 2x2, 3x3, 4x4 and 5x5 (4x4 selected by default)
- **And** a disabled button labeled "Esperando rival…".

### AC-2.2 Copy the room code ✅
- **Given** the host is in the room
- **When** they click "Copiar código"
- **Then** the code is copied to the clipboard and the button changes to "Copiado".

### AC-2.3 Rival joins ✅
- **Given** the host is waiting for a rival
- **When** a second player joins with the code
- **Then** within ~2 seconds the "Rival" row changes to "Conectado"
- **And** the start button is enabled and reads "Iniciar partida".

### AC-2.4 Choose the board size ✅
- **Given** the host is in the room
- **When** they click one of 2x2, 3x3, 4x4 or 5x5
- **Then** that option is highlighted and the match starts with that size.

### AC-2.5 Start the match ✅
- **Given** both players are in the room
- **When** the host clicks "Iniciar partida"
- **Then** the host goes to the game screen and the match starts with the chosen board.

---

## 3. Joining a room (guest)

### AC-3.1 Join successfully ✅
- **Given** the user typed a name and a valid code of a room with only 1 player
- **When** they click "Entrar a la sala"
- **Then** they see a spinner, "Sala {code}", "Esperando que el host inicie la partida…" and
  "Vas a entrar automáticamente en cuanto empiece."

### AC-3.2 Code is case-insensitive ✅
- **Given** the user types the code in lowercase or with surrounding spaces
- **Then** it is accepted as if it were typed in uppercase without spaces.

### AC-3.3 Automatic entry when the match starts ✅
- **Given** the guest is waiting for the host
- **When** the host starts the match
- **Then** within ~2 seconds the guest goes to the game screen automatically, with the same board.

---

## 4. Lobby errors

All lobby errors appear as a red message below the card. While a request is in progress, fields and
buttons are disabled.

### AC-4.1 Empty name when creating ✅
- **Given** the "Tu nombre" field in "Crear sala" is empty or only has spaces
- **When** the user clicks "Crear sala"
- **Then** they see "El nombre del jugador es obligatorio." and no room is created.

### AC-4.2 Empty name when joining ✅
- **Given** the "Tu nombre" field in "Unirse con código" is empty or only has spaces
- **When** the user clicks "Entrar a la sala"
- **Then** they see "El nombre del jugador es obligatorio."

### AC-4.3 Empty code ✅
- **Given** the "Código de sala" field is empty
- **When** the user clicks "Entrar a la sala"
- **Then** they see "El código de sala es obligatorio."

### AC-4.4 Room doesn't exist ✅
- **Given** the user types a code that doesn't match any room
- **When** they click "Entrar a la sala"
- **Then** they see "La sala no existe."

### AC-4.5 Room is full ✅
- **Given** the room already has 2 players
- **When** a third user tries to join
- **Then** they see "La sala ya tiene 2 jugadores."

### AC-4.6 Server unreachable ✅
- **Given** the backend is down or returns an error with no message
- **When** the user creates or joins a room
- **Then** they see "No se pudo completar la operación de lobby."

### AC-4.7 Clipboard not available ✅
- **Given** the browser blocks clipboard access
- **When** the host clicks "Copiar código"
- **Then** they see "No se pudo copiar el código al portapapeles."

### AC-4.8 Start before the rival joins ✅
- **Given** the host is alone in the room
- **Then** the start button is disabled ("Esperando rival…") and the match can't start.

---

## 5. Game rhythm (turns)

### AC-5.1 Initial game screen ✅
- **Given** the match has started
- **Then** both players see:
  - A top bar with "SALA {code}" and the connection status ("Conectado").
  - A turn banner.
  - A scoreboard with "Vos" (own points) and "Rival" (rival points), both at 0.
  - An N×N board with every card face down ("?").
- **And** on 3x3 and 5x5 boards, one card is marked "×" (blocked) and can't be played.

### AC-5.2 The host plays first ✅
- **Given** the match has just started
- **Then** the host sees "Tu turno", and their score card is highlighted
- **And** the guest sees "Turno rival", and the rival's score card is highlighted.

### AC-5.3 Flip the first card ✅
- **Given** it's my turn
- **When** I click a face-down card
- **Then** it turns face up for **both** players and I can still flip a second card.

### AC-5.4 Flip the second card: match ✅
- **Given** I have one card face up
- **When** I flip a second card with the same figure
- **Then** both cards stay face up for the rest of the match (matched)
- **And** I get **+1 point** (both players see the scoreboard update)
- **And** the turn passes to the rival.

### AC-5.5 Flip the second card: mismatch ✅
- **Given** I have one card face up
- **When** I flip a second card with a different figure
- **Then** both players see both cards for **1 second**, while the banner shows
  "Resolviendo jugada..."
- **And** then both cards turn face down again
- **And** the turn passes to the rival.

### AC-5.6 One move per turn (no extra turn on a match) ✅ ❓
- **Given** I just found a pair
- **Then** I **don't** play again: the turn always passes to the rival after 2 cards, whether they
  match or not.
- ❓ **To confirm**: many memory games give an extra turn after a match. Decide whether we keep
  "always alternate" (current rule, matching `docs/plan.md` §3) or switch to "play again after a
  match".

### AC-5.7 Waiting for the rival ✅
- **Given** it's the rival's turn
- **Then** I see the banner "Turno rival"
- **And** all cards are disabled for me (clicking them does nothing)
- **And** I see in real time every card the rival flips, the 1-second reveal on a mismatch and the
  score changes.

### AC-5.8 Can't flip during resolution ✅
- **Given** two cards are face up waiting to be hidden ("Resolviendo jugada...")
- **Then** no player can flip another card until they are hidden.

### AC-5.9 Can't flip a card that's already face up ✅
- **Given** a card is face up, matched or blocked
- **Then** that card is disabled and can't be flipped.

### AC-5.10 Rule violations show feedback ⚠️
- **Given** a player sends an invalid move (not their turn, card already face up, move pending
  resolution, match already finished, card doesn't exist)
- **Then** the move is rejected by the server and the board doesn't change
- **And** the player sees a clear message, for example "No es el turno del jugador.",
  "La carta no se puede levantar.", "Hay una jugada pendiente de resolución. Espera un momento.",
  "La partida ya finalizó." or "La carta no existe."
- **Current behavior**: the server rejects the move, but sends a generic `exception` event
  ("Internal server error") that the frontend ignores, so the player sees nothing. In normal use
  the UI disables these actions, so this only happens with timing races or manipulated clients.

### AC-5.11 Connection status ✅
- **Given** the player is on the game screen
- **Then** the top bar shows "Conectando..." while connecting, "Conectado" when connected, and
  "Desconectado (reintentando...)" if the connection drops.

### AC-5.12 Reconnection ✅
- **Given** a player lost the connection or reloaded the game page (with the same URL)
- **When** the connection comes back
- **Then** they see the current state of the match (board, scores and turn) and can keep playing.

### AC-5.13 Missing data in the URL ✅
- **Given** a user opens `/game` without the room or player in the URL
- **Then** they see "Faltan datos de sala o jugador para iniciar la partida."

### AC-5.14 Loading state ✅
- **Given** the game screen has opened but the state hasn't arrived yet
- **Then** the user sees "Cargando estado de la partida..."

### AC-5.15 Start errors are shown ⚠️
- **Given** the match can't start (the room doesn't have 2 players, the player isn't the host or
  the board size is invalid)
- **Then** the host sees the reason, for example "La sala aún no tiene 2 jugadores listos.",
  "Solo el jugador que creó la sala puede iniciar la partida." or
  "El tamaño del tablero debe ser 2, 3, 4 o 5."
- **Current behavior**: the start is rejected, but the host stays on "Cargando estado de la
  partida..." with no message (same cause as AC-5.10).

---

## 6. End of the match

### AC-6.1 The match ends when every pair is found ✅
- **Given** only one pair is left
- **When** a player finds it
- **Then** the match ends for both players
- **And** the banner shows "Partida finalizada" and no card can be flipped.

### AC-6.2 Winner message on the game screen ✅
- **Given** the match ended and one player has more points
- **Then** both players see "Ganó {winner name}"
- **And** a "Ver resultado final" link.

### AC-6.3 Draw message on the game screen ✅
- **Given** the match ended with the same points for both players
- **Then** both players see "Empate"
- **And** a "Ver resultado final" link.
- Note: 2x2 has 2 pairs, 3x3 has 4, 4x4 has 8 and 5x5 has 12. Every board has an even number of
  pairs, so a draw is possible on any of them.

### AC-6.4 Final result screen: winner ✅
- **Given** there's a winner
- **When** a player clicks "Ver resultado final"
- **Then** they see 🏆, "Ganó {winner name}" and "Sala: {code}".

### AC-6.5 Final result screen: draw ⚠️
- **Given** the match ended in a draw
- **When** a player clicks "Ver resultado final"
- **Then** they see 🤝 and "Empate".
- **Current behavior**: the game screen sends `winner=Empate` to the result screen, so it shows
  🏆 "Ganó Empate".

### AC-6.6 Personalized result ❓
- ❓ **To confirm**: should each player see a personal message ("¡Ganaste!" / "Perdiste") and the
  final score (for example 5 – 3), instead of only the winner's name? Today both players see the
  same message and no final score.

### AC-6.7 Actions after the match ✅
- **Given** the user is on the final result screen
- **Then** they see "Jugar de nuevo", which goes to the welcome screen
- **And** "Salir al lobby", which goes to the lobby to create or join a new room.
- ❓ **To confirm**: there is no rematch in the same room yet (out of scope in `docs/plan.md`).

---

## 7. Summary of gaps and open questions

| AC | Type | Summary |
|---|---|---|
| AC-5.6 | ❓ | Extra turn after a match, or always alternate? |
| AC-5.10 | ⚠️ | Rejected moves give no feedback to the player. |
| AC-5.15 | ⚠️ | Rejected start leaves the host on "Cargando estado de la partida...". |
| AC-6.5 | ⚠️ | A draw shows "Ganó Empate" on the result screen. |
| AC-6.6 | ❓ | Personal win/lose message and final score. |
| AC-6.7 | ❓ | Rematch in the same room. |
