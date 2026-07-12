# Memoria 1v1 / Memory 1v1

## Español

### ¿De qué se trata este proyecto?
**Memoria 1v1** es un juego online de memoria para 2 jugadores en tiempo real.

Flujo principal:
- Un jugador crea una sala.
- El segundo jugador se une con código.
- El creador elige tamaño de tablero e inicia la partida.
- Ambos jugadores juegan por turnos levantando 2 cartas:
  - Si coinciden, suman 1 punto.
  - Si no coinciden, se vuelven a ocultar.
- Gana quien tenga más puntos al finalizar.

Tecnologías:
- **Backend:** NestJS + WebSocket + SQLite (persistencia)
- **Frontend:** Angular

---

### Cómo ejecutarlo localmente

#### Requisitos
- Node.js 20+ (recomendado)
- npm 10+

#### 1) Instalar dependencias
```bash
cd Backend && npm install
cd ../Frontend && npm install
```

#### 2) Levantar backend
```bash
cd Backend
npm run start:dev
```
Backend disponible en:
- `http://localhost:3000`
- API prefijo: `http://localhost:3000/api`

#### 3) Levantar frontend (en otra terminal)
```bash
cd Frontend
npm run start
```
Frontend disponible en:
- `http://localhost:4200`

#### 4) Probar partida 1v1
- Abrir `http://localhost:4200` en una ventana normal.
- Crear sala.
- Abrir otra ventana (ideal incógnito), unirse con código.
- Iniciar partida y jugar.

#### Persistencia local
El backend guarda snapshots en SQLite por defecto en:
- `Backend/data/memoria.sqlite`

Se puede cambiar con:
- variable de entorno `DATABASE_PATH`

---

## English

### What is this project?
**Memory 1v1** is an online real-time memory game for 2 players.

Main flow:
- One player creates a room.
- The second player joins using a room code.
- The room creator selects the board size and starts the match.
- Players take turns flipping 2 cards:
  - If they match, they get 1 point.
  - If they do not match, cards are hidden again.
- The player with the highest score wins at the end.

Tech stack:
- **Backend:** NestJS + WebSocket + SQLite (persistence)
- **Frontend:** Angular

---

### How to run locally

#### Requirements
- Node.js 20+ (recommended)
- npm 10+

#### 1) Install dependencies
```bash
cd Backend && npm install
cd ../Frontend && npm install
```

#### 2) Start backend
```bash
cd Backend
npm run start:dev
```
Backend URL:
- `http://localhost:3000`
- API prefix: `http://localhost:3000/api`

#### 3) Start frontend (in another terminal)
```bash
cd Frontend
npm run start
```
Frontend URL:
- `http://localhost:4200`

#### 4) Test a 1v1 game
- Open `http://localhost:4200` in a normal browser window.
- Create a room.
- Open a second window (incognito recommended), join with the code.
- Start the game and play.

#### Local persistence
Backend stores snapshots in SQLite by default at:
- `Backend/data/memoria.sqlite`

You can override it with:
- `DATABASE_PATH` environment variable
