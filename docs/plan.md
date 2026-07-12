# Plan inicial - Proyecto "memoria"

## 1) Objetivo del producto
Construir un juego online de memoria para 2 jugadores en tiempo real, con tableros de:
- 2x2
- 3x3
- 4x4
- 5x5

Regla principal: cada jugador levanta 2 cartas por turno.  
Si son iguales, suma 1 punto. Si son distintas, se vuelven a ocultar.

---

## 2) Alcance de la primera versión (MVP)
### Incluye
- Partidas 1 vs 1 online.
- Creación de sala y unión por código.
- Inicio de partida cuando estén los 2 jugadores.
- Turnos alternados.
- Sistema de puntuación por parejas encontradas.
- Fin de partida cuando no queden parejas.
- Pantalla de resultado (ganador/empate).

### No incluye (por ahora)
- Chat en partida.
- Ranking global.
- Login social.
- Revancha automática compleja.

---

## 3) Reglas de juego (definición funcional)
1. Se crea el tablero según tamaño seleccionado.
2. Se cargan imágenes por pares y se mezclan.
3. Jugador A inicia el turno.
4. En su turno:
   - Levanta carta 1.
   - Levanta carta 2.
   - Si coinciden: +1 punto y esas cartas quedan descubiertas/bloqueadas.
   - Si no coinciden: esperar breve tiempo y volver a ocultarlas.
5. El turno pasa al otro jugador.
6. La partida termina cuando todas las parejas fueron encontradas.
7. Gana quien tenga más puntos.

---

## 4) Arquitectura propuesta
## Backend (NestJS)
- API REST para:
  - Crear sala.
  - Unirse a sala.
  - Consultar estado inicial.
- WebSocket (Gateway) para tiempo real:
  - Eventos de juego (flip carta, resultado de jugada, cambio de turno, fin de partida).
- Lógica autoritativa del juego en el servidor (evita trampas y desincronización).
- Estado de partida en memoria para MVP (luego persistencia opcional).

## Frontend (Angular)
- Vistas:
  - Home (crear/unirse sala)
  - Lobby (espera de rival)
  - Partida (tablero + puntajes + turno)
  - Resultado final
- Servicio WebSocket para escuchar estado en vivo.
- Estado UI basado en eventos del servidor (single source of truth en backend).

---

## 5) Modelo conceptual de datos (MVP)
- **Player**
  - id
  - nombre
  - socketId
- **Room**
  - id/código
  - estado (lobby | jugando | finalizada)
  - players[2]
  - game
- **Game**
  - boardSize
  - cards[]
  - turnPlayerId
  - scores (playerId -> puntos)
  - openedCards (máximo 2 temporales)
  - matchedPairs

---

## 6) Eventos en tiempo real (borrador)
- `room.created`
- `room.joined`
- `game.started`
- `card.flip.request` (cliente -> servidor)
- `card.flip.applied` (servidor -> clientes)
- `turn.changed`
- `score.updated`
- `cards.hidden`
- `game.finished`

---

## 7) Plan de implementación por fases
## Fase 1 - Base de proyecto
- Inicializar `Backend` con NestJS.
- Inicializar `Frontend` con Angular.
- Configurar CORS y conexión WebSocket.
- Definir estructura de módulos y carpetas.

## Fase 2 - Salas y lobby
- Crear sala.
- Unir jugador por código.
- Validar máximo 2 jugadores.
- Pasar a estado "listo para iniciar".

## Fase 3 - Motor del juego
- Generación de tablero por tamaño.
- Mezcla de pares.
- Validación de jugadas por turno.
- Comparación de cartas y puntuación.
- Cierre de partida y ganador.

## Fase 4 - Interfaz de juego (Angular)
- Renderizado de grilla dinámica.
- Estado de cartas (oculta/visible/encontrada).
- Indicador de turno y score.
- Bloqueo de interacción cuando no corresponde.

## Fase 5 - Estabilización
- Pruebas unitarias en lógica de juego.
- Pruebas de flujo 1v1 (crear/join/jugar/finalizar).
- Manejo de desconexión y reconexión básica.
- Documentación técnica mínima.

---

## 8) Riesgos y decisiones tempranas
- **Sincronización:** toda regla crítica se valida en backend.
- **Paridad de cartas en tableros impares:** 3x3 y 5x5 requieren definición de diseño.
  - Propuesta: usar pares + 1 carta comodín especial (sin pareja) **o**
  - limitar tamaños a pares de celdas (2x2 y 4x4) para MVP.
  - **Decisión pendiente del producto.**
- **Desconexiones:** definir política (pausa, abandono, victoria automática).

---

## 9) Próximo paso recomendado
Antes de codificar, cerrar estas 3 decisiones:
1. ¿Cómo resolver tableros 3x3 y 5x5 (comodín o regla alternativa)?
2. ¿Tiempo de espera al mostrar 2 cartas no coincidentes (ej: 1 segundo)?
3. ¿Qué pasa si un jugador se desconecta durante la partida?

---

## 10) Estado de avance
### Fase 1 - Base de proyecto (completada)
- `Backend` inicializado con NestJS.
- `Frontend` inicializado con Angular.
- CORS configurado en backend (origen frontend + credenciales).
- WebSocket base configurado con namespace `game`.
- Estructura inicial de backend creada (`rooms` y `game`).
- Estructura inicial de frontend creada (`home`, `lobby`, `game`, `result`).

### Fase 2 - Salas y lobby (completada)
- Endpoint REST para crear sala: `POST /api/rooms`.
- Endpoint REST para unirse a sala por código: `POST /api/rooms/:roomCode/join`.
- Endpoint REST para consultar estado de sala: `GET /api/rooms/:roomCode`.
- Validación de máximo 2 jugadores por sala.
- Estado de sala actualizado a `ready` cuando se completa el segundo jugador.
- Lobby en frontend conectado al backend para crear/unirse/consultar sala.

### Fase 3 - Motor del juego (completada)
- Inicio de partida en tiempo real con `game.start.request`.
- Generación y mezcla de tablero para 2x2, 3x3, 4x4 y 5x5.
- Validación de turnos y levantamiento de cartas en backend.
- Lógica de comparación de pares, puntuación y cambio de turno.
- Ocultamiento diferido de cartas no coincidentes (`cards.hidden`).
- Finalización de partida y cálculo de ganador/empate.
- Para tableros impares (3x3 y 5x5), se agrega 1 carta `blocked` no jugable para completar la grilla.

### Fase 4 - Interfaz de juego (completada)
- Renderizado visual de grilla dinámica con estilos de cartas por estado.
- Estados de carta diferenciados: `hidden`, `revealed`, `matched` y `blocked`.
- Indicador de turno, estado de partida y marcador visual de jugador activo.
- Bloqueo de interacción en frontend cuando no corresponde jugar o hay resolución pendiente.
- Pantalla de resultado conectada con datos de sala y ganador/empate.

### Fase 5 - Estabilización (completada)
- Pruebas unitarias para salas (`RoomsService`) y motor de juego (`GameService`).
- Prueba de flujo 1v1 en backend: crear sala, unir jugador, iniciar, jugar y finalizar.
- Manejo básico de reconexión en frontend: resincroniza estado al reconectar.
- Indicador de estado de conexión en la pantalla de partida.

### Fase 6 - Persistencia en base de datos (completada)
- Persistencia de salas y partidas en SQLite (`better-sqlite3`).
- Carga automática de snapshots de salas y partidas al iniciar backend.
- Guardado automático en cada cambio de sala (crear/unirse) y de partida (iniciar/flip/resolver).
- Soporte configurable con `DATABASE_PATH` (por defecto `Backend/data/memoria.sqlite`).
