# Scrabbly Web

Real-time multiplayer Scrabble en el navegador, con backend en **Node.js +
Express + Socket.IO** y un engine propio en JS basado en `scrabbly`.

## Features

- Tablero estándar 15×15 con casilleros premium (TW, DW, TL, DL, ★ central).
- Atril de 7 fichas, bolsa con la distribución oficial (sin fichas en blanco
  por ahora).
- Validación contra los diccionarios `english.txt` / `spanish.txt` del
  paquete `scrabbly`.
- Scoring con multiplicadores de letra y palabra, que aplican solo a fichas
  recién jugadas. Bonus de **+50 puntos por bingo** (usar las 7 fichas).
- Selector de idioma (inglés / español) por sala.
- Multijugador en salas de hasta 4 jugadores con código corto.
- Turnos, pasar, cambiar fichas (mientras la bolsa tenga ≥ 7), historial,
  chat en vivo.
- Fin de partida automático cuando la bolsa se vacía y un jugador queda
  sin fichas, o tras 6 pases consecutivos. Resta de fichas restantes y
  declaración de ganador / empate.
- Reconexión automática (sessionStorage) si refrescás la pestaña.

## Run

```bash
cd web
npm install
npm start
```

Abrí `http://localhost:3000`. Compartí el código de sala con tus amigos
(la app y los amigos tienen que poder llegar al mismo servidor).

## Cómo jugar

1. Cargá tu nombre y creá una sala (eligiendo idioma) o uniéndote con un
   código.
2. Esperá al menos un segundo jugador y tocá **Empezar partida**.
3. En tu turno:
   - Click en una ficha del atril para seleccionarla.
   - Click en una casilla vacía del tablero para colocarla. Repetí.
   - **Devolver fichas** vuelve todo al atril; click en una ficha en el
     tablero también la devuelve.
   - **Mezclar atril** reordena tus fichas (cosmético).
   - **Cambiar seleccionadas**: marcá fichas con `Shift+click` y tocá el
     botón.
   - **Pasar** salta tu turno.
   - **Jugar** envía la jugada al servidor; si no es válida (palabra
     inexistente, fichas no contiguas, primer movimiento sin pasar por el
     centro, etc.) vas a ver el error y podés reintentar.

## Endpoints

- `GET /` → la app
- `GET /health` → `{ ok: true }`

## Estructura

```
web/
  package.json
  server/
    index.js        # Express + Socket.IO entrypoint
    engine.js       # Tablero, validación, scoring
    bonuses.js      # Casilleros premium y distribución de fichas
    dictionary.js   # Carga + parseo de english.txt y spanish.txt
    rooms.js        # Salas, turnos, fin de partida
  public/
    index.html
    style.css
    client.js
```
