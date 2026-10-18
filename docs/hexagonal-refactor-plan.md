# Plan de refactor: arquitectura hexagonal en el Backend

Objetivo: llevar `Backend/` a arquitectura hexagonal (Ports & Adapters) sin cambiar el comportamiento observable (REST, eventos Socket.IO ni formato de snapshots en SQLite). El frontend no cambia.

## 1. Problemas actuales

| Dónde | Problema |
|---|---|
| `GameService` | Mezcla reglas del juego, `Map` en memoria, persistencia SQLite, generación de ids/mezcla aleatoria y excepciones de Nest en un solo `@Injectable`. |
| `GameService → RoomsService` | Un feature depende del servicio concreto de otro. |
| `RoomsService` | La misma mezcla: reglas, `Map`, persistencia, `randomUUID`/`Math.random`. |
| `GameGateway` | Tiene flujo de aplicación (timer de 1s del mismatch, qué eventos emitir) en lugar de solo traducir el protocolo. |
| `SQLitePersistenceService` | Almacén genérico `loadX<T>`/`saveX<T>` que los servicios llaman a mano tras cada mutación, inyectado como `@Optional()`. |
| Errores | Las reglas lanzan `BadRequestException` y similares, acoplando el dominio a HTTP. |
| Normalización del código de sala | Duplicada en tres lugares (rooms service, game service, gateway). |

## 2. Estructura objetivo

```text
src/
  shared/
    domain/errors.ts                      # DomainError: InvalidInputError, ConflictError, NotFoundError
    application/ports/id-generator.port.ts
    adapters/crypto-id.generator.ts       # randomUUID
    adapters/http/domain-error.filter.ts  # DomainError → 400/409/404
    adapters/ws/domain-error.filter.ts    # DomainError → evento WS 'exception'
  rooms/
    domain/
      room.ts                  # Agregado Room: create(), join(), regla lobby/ready, creador = players[0]
      room-code.ts             # Value object RoomCode: trim/upper + alfabeto + largo 6
      player-name.ts           # Value object PlayerName (trim, obligatorio)
    application/
      ports/outbound/room-repository.port.ts      # findByCode, exists, save
      ports/outbound/room-code-generator.port.ts
      use-cases/create-room.use-case.ts
      use-cases/join-room.use-case.ts
      use-cases/get-room.use-case.ts
    adapters/
      inbound/http/rooms.controller.ts
      outbound/sqlite/sqlite-room.repository.ts
      outbound/memory/in-memory-room.repository.ts
      outbound/random-room-code.generator.ts
    rooms.module.ts            # composition root del feature
  game/
    domain/
      game.ts                  # Agregado Game: start, flip, resolveMismatch, fin/ganador, rotación de turno
      board.ts                 # buildBoard(size, ids, shuffler): pares + carta blocked en grillas impares
      board-size.ts            # Value object BoardSize (2|3|4|5)
      public-game-state.ts     # toPublicState(): oculta `value` de cartas hidden (regla anti-trampa)
      flip-outcome.ts          # 'first-card' | 'match' | 'mismatch' | 'finished'
    application/
      ports/outbound/game-repository.port.ts
      ports/outbound/room-lookup.port.ts          # lo que game necesita de rooms (jugadores, estado, creador)
      ports/outbound/game-events.port.ts          # gameStarted, cardFlipped, scoreUpdated, turnChanged, cardsHidden, gameFinished, stateUpdated
      ports/outbound/mismatch-scheduler.port.ts   # schedule(roomCode, callback), cancel
      ports/outbound/shuffler.port.ts
      use-cases/start-game.use-case.ts
      use-cases/flip-card.use-case.ts             # en mismatch → scheduler.schedule(...)
      use-cases/resolve-mismatch.use-case.ts
      use-cases/get-game-state.use-case.ts        # reemplaza también hasGame() (find → null)
    adapters/
      inbound/ws/game.gateway.ts                  # payload → input del caso de uso, join de rooms, ack
      inbound/http/game.controller.ts
      outbound/ws/socket-io-game-events.ts        # llamadas al port → nombres de evento, server.to(room).emit
      outbound/timer/timeout-mismatch-scheduler.ts  # setTimeout 1000ms, un timer por sala
      outbound/sqlite/sqlite-game.repository.ts
      outbound/memory/in-memory-game.repository.ts
      outbound/rooms/room-lookup.adapter.ts       # delega en GetRoomUseCase de rooms
    game.module.ts
  persistence/
    sqlite-database.ts         # una conexión + schema, provista con un token DB (solo adapters)
    persistence.module.ts
```

## 3. Decisiones de diseño

1. **Ports síncronos.** `better-sqlite3` es síncrono y hoy cada jugada hace carga → mutación → guardado sin ceder el event loop, así que dos jugadas simultáneas no se intercalan. Ports `async` agregarían puntos de `await` entre carga y guardado, creando una condición de carrera sobre el turno. Si en el futuro se cambia a una base async, se agrega serialización por sala.
2. **Repositorios en lugar de "persistir tras cada mutación".** Los casos de uso terminan con `repository.save(game)`. Cada repositorio SQLite mantiene el patrón actual: caché en memoria write-through, cargada en `onModuleInit` del adapter (no del dominio).
3. **Compatibilidad de snapshots.** El mapper del repositorio lee y escribe **exactamente** las formas JSON actuales (`InternalGameState`, `RoomSnapshot`), así los archivos `data/memoria.sqlite` existentes siguen cargando. `Game.rehydrate(snapshot)` / `game.toSnapshot()`.
4. **Errores de dominio + filtros.** El dominio lanza `ConflictError('No es el turno del jugador.')`, etc., con los mismos mensajes en español. El filtro HTTP los mapea a los mismos códigos de estado: el comportamiento REST no cambia.
5. **Gateway delgado.** "Qué eventos emitir y en qué orden" pasa a los casos de uso como llamadas a `GameEventsPort`. El adapter de sockets mantiene exactamente los nombres y el orden de eventos actuales (la lista `socketEvents` del frontend no cambia). El timer de 1s queda detrás de `MismatchSchedulerPort`, y reprogramar la misma sala cancela el timer anterior, como hoy.
6. **Acceso entre features por port.** `game` define `RoomLookupPort` con solo lo que necesita; su adapter llama a `GetRoomUseCase` de `rooms`. `game` no importa nada interno de `rooms`.
7. **Composición.** Los casos de uso son clases planas (sin `@Injectable`). Cada `*.module.ts` enlaza ports con `{ provide: GAME_REPOSITORY, useClass: SqliteGameRepository }` y construye casos de uso con `useFactory`. Todo el wiring vive ahí.
8. **Aleatoriedad inyectada.** `ShufflerPort`, `RoomCodeGeneratorPort` e `IdGeneratorPort` hacen deterministas los tests de tablero y código. Los tests actuales leen el `Map` privado (`getInternalGame`); con aleatoriedad inyectada eso ya no hace falta.

## 4. Control de límites

Overrides de `no-restricted-imports` en `eslint.config.mjs`:
- `**/domain/**`: prohibido `@nestjs/*`, `socket.io`, `better-sqlite3`, `node:crypto`, `**/application/**`, `**/adapters/**`.
- `**/application/**`: prohibido `@nestjs/*`, `socket.io`, `better-sqlite3`, `**/adapters/**`.

Así `npm run lint` falla cuando se rompe la arquitectura.

## 5. Orden de migración (strangler, tests en verde después de cada paso)

| # | Paso | Red de seguridad |
|---|---|---|
| 0 | **Tests de caracterización** antes de tocar nada: (a) e2e REST de crear/unirse/consultar sala, 409 por sala llena, 404 de partida; (b) e2e Socket.IO que verifica la secuencia exacta de eventos en match, mismatch y fin; (c) round-trip de SQLite con un `DATABASE_PATH` temporal y forma de los snapshots. | Tests nuevos |
| 1 | `shared/`: errores de dominio, filtros HTTP/WS, `IdGeneratorPort`. | Tests existentes |
| 2 | **Slice de salas:** dominio (`Room`, `RoomCode`, `PlayerName`), ports, los tres casos de uso, repositorios SQLite + memoria; `RoomsController` pasa a usar los casos de uso. Una fachada temporal mantiene `RoomsService.getRoom` para `GameService`. | Tests unitarios de dominio y casos de uso con fakes; e2e del paso 0 |
| 3 | **Dominio del juego:** mover las reglas de `GameService` al agregado puro `Game` + `board.ts`; `GameService` delega. Reescribir `game.service.spec.ts` como tests de dominio sin Nest ni `RoomsService`. | Tests de dominio; e2e de sockets del paso 0 |
| 4 | **Aplicación del juego:** los cuatro casos de uso, `GameRepository`, `RoomLookupPort`. Se eliminan `GameService` y la fachada de rooms. | Tests de casos de uso con fakes en memoria |
| 5 | **Gateway:** `GameEventsPort` + adapter Socket.IO, `MismatchSchedulerPort` + adapter de timeout. El gateway queda solo como traductor del protocolo. | e2e de orden de eventos del paso 0 |
| 6 | **Limpieza:** eliminar `SQLitePersistenceService` (reemplazado por `sqlite-database.ts` + repositorios), agregar las reglas de capas en ESLint, actualizar `CLAUDE.md` (sección Backend modules, nota de tests con `new RoomsService()`) y "Estado de avance" en `docs/plan.md`. | `npm test`, `npm run test:e2e`, `npm run lint`, partida manual en 2 ventanas |

Cada paso es un commit independiente y reversible.

## 6. Fuera de alcance / hallazgos

- **Los errores WS hoy se pierden:** el gateway lanza `HttpException` y el filtro WS por defecto de Nest responde `exception` con `{ status: 'error', message: 'Internal server error', cause: { pattern, data } }`; el frontend tampoco escucha `exception`. El nuevo filtro WS podría enviar el mensaje real en español, pero eso cambia el comportamiento: se decide aparte. Los tests del paso 0 fijan el comportamiento actual.
- **Timers de mismatch huérfanos:** `app.close()` no cancela los timers del gateway; si queda un mismatch pendiente, el callback corre después del cierre e intenta escribir en SQLite. **Corregido en el paso 5:** `TimeoutMismatchScheduler` los cancela en `onModuleDestroy` (cubierto por `test/persistence.e2e-spec.ts`).
- **Partida trabada tras reinicio:** si el servidor se reinicia con un mismatch pendiente, el snapshot se restaura con 2 cartas en `openedCardIds` pero sin timer, y toda jugada posterior se rechaza. Es un bug existente (detectado leyendo el código, no cubierto por tests); se puede corregir después del refactor reprogramando la resolución al cargar.
- `AppController`/`AppService` ("Hello World") quedan como están porque el e2e existente depende de ellos.
- Sin cambios en el frontend: formas REST, nombres de eventos y payloads se mantienen.

## 7. Estado

- [x] Paso 0: tests de caracterización (`test/rooms.e2e-spec.ts`, `test/game.e2e-spec.ts`, `test/persistence.e2e-spec.ts`, helpers en `test/support/test-app.ts`; 21 tests nuevos en `npm run test:e2e`)
- [x] Paso 1: `shared/`. `DomainError` (+ `InvalidInputError`, `ConflictError`, `NotFoundError`) reemplaza las excepciones de Nest en `RoomsService`, `GameService` y `GameGateway`. `DomainErrorHttpFilter` se registra como `APP_FILTER` en `AppModule` y produce el mismo cuerpo `{ statusCode, error, message }`. Los filtros globales no llegan a los gateways, así que `DomainErrorWsFilter` se aplica con `@UseFilters` en `GameGateway`: emite el mismo payload `exception` que antes y evita que Nest loguee cada jugada rechazada (`HttpException` es `IntrinsicException` y no se logueaba; un `Error` común sí). `IdGenerator`/`CryptoIdGenerator` quedan listos para enlazarse en el paso 2.
- [x] Paso 2: slice de salas. `RoomsService`, `rooms.controller.ts` y `room.types.ts` se eliminaron. Dominio: `Room` (inmutable, `join()` devuelve una sala nueva y valida el asiento libre antes del nombre), `RoomCode`, `PlayerName`. Aplicación: `CreateRoomUseCase`, `JoinRoomUseCase`, `GetRoomUseCase` y los ports `RoomRepository` / `RoomCodeGenerator`. Adapters: `RoomsController`, `SqliteRoomRepository` (caché write-through sobre `SQLitePersistenceService`, mismo JSON), `InMemoryRoomRepository`, `RandomRoomCodeGenerator`; ambos repositorios pasan la misma suite de contrato (`room-repository.contract-spec.ts`). Cambios respecto del plan: (1) no hizo falta la fachada temporal: `GameService` usa `GetRoomUseCase` directamente hasta el paso 4; (2) `RoomCode` solo normaliza y no valida alfabeto/largo, porque hoy un código mal formado devuelve 404 y no 400.
- [x] Paso 3: dominio del juego. Nuevo `game/domain/`: `Game` (inmutable: `start()`, `flip()` → `{ game, outcome }`, `resolveMismatch()`, `hasPendingMismatch`, `rehydrate()`/`toSnapshot()` con la misma forma JSON que `InternalGameState`), `BoardSize`, `buildBoard()` (recibe `newCardId` y `shuffle` como funciones, sin depender de ports) y `toPublicGameState()`. `GameService` queda como cáscara transitoria: guarda `Game` en el `Map`, persiste `toSnapshot()` y traduce `FlipOutcome` al `FlipResult` que usa el gateway. `game.service.spec.ts` se reemplazó por tests de dominio deterministas (ids secuenciales, sin mezclar), sin Nest ni rooms. Notas: (1) el dominio del juego usa el código de sala como `string`; normalizarlo es tarea del caso de uso (paso 4), así `game/domain` no depende de `rooms/domain`; (2) los tres chequeos de invariantes inalcanzables ("No se pudieron resolver las cartas", "No se encontró score", "No se encontró el turno") ahora lanzan `Error` común en vez de `NotFoundException`, porque indican un bug y no un error del usuario.
- [x] Paso 4: aplicación del juego. `GameService`, `game.types.ts` y el controller/gateway viejos se eliminaron. Casos de uso: `StartGameUseCase`, `FlipCardUseCase` (devuelve `{ state, outcome }`), `ResolveMismatchUseCase` y `GetGameStateUseCase` (`execute()` lanza 404, `find()` devuelve null y reemplaza `hasGame()`). Ports: `GameRepository`, `RoomLookup`, `Shuffler`. Adapters: `SqliteGameRepository` y `InMemoryGameRepository` (misma suite de contrato), `FisherYatesShuffler`, `RoomsRoomLookup` (delega en `GetRoomUseCase`), y `GameController`/`GameGateway` movidos a `adapters/inbound/`. El gateway decide los eventos a partir de `FlipOutcome`, con los mismos eventos que antes. Cambios respecto del plan: (1) `RoomCode` pasó a `shared/domain/`, porque es el identificador común a sala y partida; así se eliminó la normalización duplicada en `GameService` y el gateway sin que `game/` dependa de `rooms/domain`; (2) nuevo `SharedModule` que provee `ID_GENERATOR` a ambos features; (3) el `StartGameInput` del dominio se renombró a `NewGameInput` para no confundirlo con el del caso de uso.
- [x] Paso 5: gateway. Nuevos ports `GameEvents` (un método por evento de sala) y `MismatchScheduler` (`schedule(roomCode, delayMs, task)`; reprogramar la misma sala cancela la anterior). Los casos de uso deciden qué eventos emitir y en qué orden: `StartGameUseCase` (`gameStarted`, `stateUpdated`, también si la partida ya existía), `FlipCardUseCase` (`cardFlipped`, `stateUpdated`, `scoreUpdated`, `gameFinished` o `turnChanged`, y en mismatch programa `ResolveMismatchUseCase` a `MISMATCH_REVEAL_MS` = 1000), `ResolveMismatchUseCase` (`cardsHidden`, `turnChanged`, `stateUpdated`). Adapters: `SocketIoGameEvents` (nombres de eventos), `TimeoutMismatchScheduler` (cancela los timers en `onModuleDestroy` y loguea una tarea fallida en vez de tumbar el proceso) y `SocketServerRef` (el gateway le pasa el namespace en `afterInit`, así se evita el ciclo gateway → casos de uso → eventos → gateway). El gateway solo traduce el protocolo. Para mantener el comportamiento, el gateway une al solicitante a la sala *antes* de llamar a `StartGameUseCase` (antes se unía después de iniciar, pero antes de emitir) y lo saca si el inicio falla. Tests nuevos: orden de eventos en los casos de uso (fake que registra + scheduler manual), adapters (fake timers, namespace falso) y 3 e2e: solicitante sin suscribir recibe `game.started`, un inicio rechazado no une a la sala, y un mismatch pendiente no se ejecuta tras el cierre (corrige el hallazgo de timers huérfanos de la sección 6).
- [x] Paso 6: limpieza. `SQLitePersistenceService` se eliminó. `persistence/sqlite-database.ts` abre la conexión y `PersistenceModule` la provee con el token `SQLITE_DATABASE` y la cierra en `onApplicationShutdown` (corre después de que `TimeoutMismatchScheduler` cancela los timers en `onModuleDestroy`; antes la conexión nunca se cerraba). Cambio respecto del plan: el schema no vive en `sqlite-database.ts`; cada repositorio SQLite crea su propia tabla y tiene su SQL, así `persistence/` no conoce ningún feature. Las reglas de capas están en `eslint.config.mjs` con `no-restricted-imports` (patrones `regex`, para que también apliquen a imports relativos): `domain/` no puede importar frameworks, módulos de Node, `application/` ni `adapters/`; `application/` no puede importar frameworks, módulos de Node ni `adapters/`, salvo los `*.spec.ts`, que usan los repositorios en memoria como fakes. Se verificó con archivos de prueba que rompían cada regla. `CLAUDE.md` y "Estado de avance" en `docs/plan.md` están actualizados. Pendiente: la partida manual en 2 ventanas.
