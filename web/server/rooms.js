import { randomUUID } from "node:crypto";
import {
  InvalidPlayError,
  buildBag,
  consumeRack,
  drawTiles,
  emptyBoard,
  evaluateMove,
} from "./engine.js";
import { BONUSES, LETTER_VALUES, RACK_SIZE } from "./bonuses.js";
import { loadDictionary } from "./dictionary.js";

const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;
const PASS_LIMIT = 6; // 3 consecutive passes per player ends the game.

function shortId(len = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export class GameRoom {
  constructor({ id, language }) {
    this.id = id;
    this.language = language;
    this.players = []; // [{ id, name, socketId, score, rack, connected }]
    this.board = emptyBoard();
    this.bag = buildBag(language);
    this.turnIndex = 0;
    this.status = "waiting"; // waiting | playing | over
    this.history = []; // [{ player, words, points }]
    this.consecutivePasses = 0;
    this.dictionary = null; // populated once on first start
    this.firstMoveDone = false;
    this.winnerIds = [];
  }

  async ensureDictionary() {
    if (!this.dictionary) {
      this.dictionary = await loadDictionary(this.language);
    }
  }

  addPlayer({ name, socketId }) {
    if (this.status !== "waiting") {
      throw new Error("La partida ya empezó.");
    }
    if (this.players.length >= MAX_PLAYERS) {
      throw new Error("La sala está llena.");
    }
    const player = {
      id: randomUUID(),
      name: name.slice(0, 20) || `Jugador ${this.players.length + 1}`,
      socketId,
      score: 0,
      rack: [],
      connected: true,
    };
    this.players.push(player);
    return player;
  }

  removePlayer(playerId) {
    const idx = this.players.findIndex((p) => p.id === playerId);
    if (idx === -1) return;
    if (this.status === "waiting") {
      this.players.splice(idx, 1);
    } else {
      this.players[idx].connected = false;
    }
  }

  setSocket(playerId, socketId) {
    const p = this.players.find((p) => p.id === playerId);
    if (!p) return null;
    p.socketId = socketId;
    p.connected = true;
    return p;
  }

  async start() {
    if (this.status !== "waiting") throw new Error("La partida ya empezó.");
    if (this.players.length < MIN_PLAYERS) {
      throw new Error("Hacen falta al menos 2 jugadores.");
    }
    await this.ensureDictionary();
    for (const p of this.players) {
      p.rack = drawTiles(this.bag, RACK_SIZE);
    }
    this.status = "playing";
    this.turnIndex = 0;
  }

  currentPlayer() {
    return this.players[this.turnIndex] ?? null;
  }

  requireTurn(playerId) {
    if (this.status !== "playing") {
      throw new InvalidPlayError("La partida no está en curso.");
    }
    const cur = this.currentPlayer();
    if (!cur || cur.id !== playerId) {
      throw new InvalidPlayError("No es tu turno.");
    }
    return cur;
  }

  playMove(playerId, placements) {
    const player = this.requireTurn(playerId);
    const newRack = consumeRack(player.rack, placements);
    const result = evaluateMove({
      board: this.board,
      language: this.language,
      dictionary: this.dictionary,
      placements,
      isFirstMove: !this.firstMoveDone,
    });
    this.board = result.board;
    this.firstMoveDone = true;
    player.score += result.score;
    const refill = drawTiles(this.bag, RACK_SIZE - newRack.length);
    player.rack = [...newRack, ...refill];
    this.consecutivePasses = 0;
    this.history.push({
      player: player.name,
      playerId: player.id,
      words: result.words,
      points: result.score,
    });
    this.checkEndGame(player);
    if (this.status === "playing") this.advanceTurn();
    return result;
  }

  pass(playerId) {
    const player = this.requireTurn(playerId);
    this.consecutivePasses += 1;
    this.history.push({
      player: player.name,
      playerId: player.id,
      words: [{ word: "(paso)", points: 0 }],
      points: 0,
    });
    if (this.consecutivePasses >= PASS_LIMIT) {
      this.endGame();
      return;
    }
    this.advanceTurn();
  }

  exchange(playerId, indices) {
    const player = this.requireTurn(playerId);
    if (this.bag.length < RACK_SIZE) {
      throw new InvalidPlayError("Quedan menos de 7 fichas en la bolsa, no se puede cambiar.");
    }
    if (!Array.isArray(indices) || indices.length === 0) {
      throw new InvalidPlayError("Elegí al menos una ficha para cambiar.");
    }
    const sorted = [...new Set(indices)].sort((a, b) => b - a);
    const returned = [];
    const newRack = player.rack.slice();
    for (const i of sorted) {
      if (i < 0 || i >= newRack.length) {
        throw new InvalidPlayError("Índice de ficha inválido.");
      }
      returned.push(newRack[i]);
      newRack.splice(i, 1);
    }
    const drawn = drawTiles(this.bag, returned.length);
    this.bag.push(...returned);
    // Re-shuffle so returned tiles aren't drawn next.
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }
    player.rack = [...newRack, ...drawn];
    this.consecutivePasses = 0;
    this.history.push({
      player: player.name,
      playerId: player.id,
      words: [{ word: `(cambio ${returned.length})`, points: 0 }],
      points: 0,
    });
    this.advanceTurn();
  }

  advanceTurn() {
    if (this.status !== "playing") return;
    this.turnIndex = (this.turnIndex + 1) % this.players.length;
  }

  checkEndGame(lastPlayer) {
    if (this.bag.length === 0 && lastPlayer.rack.length === 0) {
      // Subtract remaining rack values from each player; add the sum to the
      // player who emptied their rack.
      let bonus = 0;
      for (const p of this.players) {
        if (p.id === lastPlayer.id) continue;
        const remaining = p.rack.reduce((acc, l) => {
          const v = (LETTER_VALUES[this.language] ?? {})[l] ?? 0;
          return acc + v;
        }, 0);
        p.score -= remaining;
        bonus += remaining;
      }
      lastPlayer.score += bonus;
      this.endGame();
    }
  }

  endGame() {
    this.status = "over";
    const top = Math.max(...this.players.map((p) => p.score));
    this.winnerIds = this.players.filter((p) => p.score === top).map((p) => p.id);
  }

  publicState(forPlayerId = null) {
    return {
      roomId: this.id,
      language: this.language,
      status: this.status,
      bonuses: BONUSES,
      board: this.board,
      bagSize: this.bag.length,
      currentTurn: this.currentPlayer()?.id ?? null,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        rackSize: p.rack.length,
        connected: p.connected,
        isYou: p.id === forPlayerId,
      })),
      yourRack:
        this.players.find((p) => p.id === forPlayerId)?.rack ?? [],
      history: this.history,
      winnerIds: this.winnerIds,
    };
  }
}

export class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  create({ language }) {
    let id;
    do {
      id = shortId();
    } while (this.rooms.has(id));
    const room = new GameRoom({ id, language });
    this.rooms.set(id, room);
    return room;
  }

  get(id) {
    return this.rooms.get(id) ?? null;
  }

  delete(id) {
    this.rooms.delete(id);
  }
}
