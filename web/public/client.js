/* global io */

const socket = io({ autoConnect: true });

// Letter values mirroring server/bonuses.js so we can show points on tiles.
const LETTER_VALUES = {
  english: {
    A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,
    Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10,
  },
  spanish: {
    A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,L:1,M:3,N:1,"Ñ":8,O:1,
    P:3,Q:10,R:1,S:1,T:1,U:1,V:4,X:8,Y:4,Z:10,
  },
};

const BONUS_LABELS = {
  TW: "TW", DW: "DW", TL: "TL", DL: "DL", ST: "★",
};

// ---- App state -----------------------------------------------------------

const state = {
  roomId: null,
  playerId: null,
  language: "spanish",
  serverState: null,
  // Tiles the player has dropped on the board this turn but not submitted yet.
  // Map<"r,c", { rackIndex, letter }>
  pending: new Map(),
  selectedRackIndex: null,
  exchangeSelection: new Set(),
};

// Drag source for the active drag operation. Cleared on dragend.
// { kind: "rack", index } | { kind: "board", row, col }
let dragSource = null;

function isOurTurn() {
  const s = state.serverState;
  return !!s && s.status === "playing" && s.currentTurn === state.playerId;
}

function lv(letter) {
  return LETTER_VALUES[state.language]?.[letter.toUpperCase()] ?? 0;
}

// ---- DOM refs ------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const lobby = $("lobby");
const game = $("game");
const overlay = $("overlay");
const boardEl = $("board");
const rackEl = $("rack");
const playersEl = $("players");
const historyEl = $("history");
const chatEl = $("chat");
const playMsg = $("play-message");
const lobbyError = $("lobby-error");

// ---- Persistence: rejoin after refresh -----------------------------------

function persistSession() {
  if (state.roomId && state.playerId) {
    sessionStorage.setItem(
      "scrabbly",
      JSON.stringify({ roomId: state.roomId, playerId: state.playerId }),
    );
  }
}

function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem("scrabbly") ?? "null");
  } catch {
    return null;
  }
}

socket.on("connect", () => {
  const saved = loadSession();
  if (saved && !state.roomId) {
    socket.emit("lobby:rejoin", saved, (resp) => {
      if (resp?.ok) {
        state.roomId = resp.roomId;
        state.playerId = resp.playerId;
        showGame();
      } else {
        sessionStorage.removeItem("scrabbly");
      }
    });
  }
});

// ---- Lobby ---------------------------------------------------------------

$("create-btn").addEventListener("click", () => {
  const name = $("name").value.trim() || "Jugador";
  const language = $("language").value;
  state.language = language;
  socket.emit("lobby:create", { name, language }, (resp) => {
    if (resp.ok) {
      state.roomId = resp.roomId;
      state.playerId = resp.playerId;
      persistSession();
      showGame();
    } else {
      lobbyError.textContent = resp.error;
    }
  });
});

$("join-btn").addEventListener("click", () => {
  const name = $("name").value.trim() || "Jugador";
  const roomId = $("room-code").value.trim().toUpperCase();
  if (!roomId) { lobbyError.textContent = "Ingresá un código."; return; }
  socket.emit("lobby:join", { name, roomId }, (resp) => {
    if (resp.ok) {
      state.roomId = resp.roomId;
      state.playerId = resp.playerId;
      persistSession();
      showGame();
    } else {
      lobbyError.textContent = resp.error;
    }
  });
});

function showGame() {
  lobby.classList.add("hidden");
  game.classList.remove("hidden");
  $("room-id-label").textContent = state.roomId;
}

// ---- Server state updates ------------------------------------------------

socket.on("game:state", (s) => {
  state.serverState = s;
  state.language = s.language;
  // Drop any pending placement that no longer fits (e.g. server confirmed the move).
  for (const key of [...state.pending.keys()]) {
    const [r, c] = key.split(",").map(Number);
    if (s.board[r][c] !== null) state.pending.delete(key);
  }
  state.exchangeSelection.clear();
  state.selectedRackIndex = null;
  render();
});

socket.on("game:chat", ({ from, message }) => {
  const li = document.createElement("li");
  li.innerHTML = `<span class="who">${escapeHtml(from)}:</span> ${escapeHtml(message)}`;
  chatEl.appendChild(li);
  chatEl.scrollTop = chatEl.scrollHeight;
});

// ---- Rendering -----------------------------------------------------------

function render() {
  const s = state.serverState;
  if (!s) return;

  $("lang-label").textContent = s.language === "english" ? "English" : "Español";
  $("bag-size").textContent = s.bagSize;

  // Players list & start button.
  playersEl.innerHTML = "";
  for (const p of s.players) {
    const li = document.createElement("li");
    if (p.id === s.currentTurn) li.classList.add("turn");
    const nameSpan = document.createElement("span");
    nameSpan.classList.add("name");
    if (p.id === state.playerId) nameSpan.classList.add("you");
    if (!p.connected) nameSpan.classList.add("offline");
    nameSpan.textContent = p.name;
    const score = document.createElement("span");
    score.textContent = p.score;
    li.append(nameSpan, score);
    playersEl.appendChild(li);
  }

  const startBtn = $("start-btn");
  if (s.status === "waiting") {
    startBtn.classList.remove("hidden");
    startBtn.disabled = s.players.length < 2;
  } else {
    startBtn.classList.add("hidden");
  }

  renderBoard(s);
  renderRack(s);
  renderHistory(s);
  renderTurnBar(s);

  if (s.status === "over") showOverlay(s);
  else overlay.classList.add("hidden");
}

function renderTurnBar(s) {
  const turn = s.players.find((p) => p.id === s.currentTurn);
  if (s.status === "waiting") {
    $("turn-info").textContent = `Esperando jugadores… (${s.players.length}/4)`;
  } else if (s.status === "over") {
    $("turn-info").textContent = "Partida terminada";
  } else if (turn?.id === state.playerId) {
    $("turn-info").textContent = "Tu turno";
  } else {
    $("turn-info").textContent = `Turno de ${turn?.name ?? "—"}`;
  }
}

function renderBoard(s) {
  boardEl.innerHTML = "";
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");
      cell.dataset.row = r;
      cell.dataset.col = c;

      const bonus = s.bonuses[r][c];
      if (bonus) {
        cell.classList.add(bonus.toLowerCase());
        if (s.board[r][c] === null && !state.pending.has(`${r},${c}`)) {
          cell.textContent = BONUS_LABELS[bonus];
        }
      }

      const lockedLetter = s.board[r][c];
      if (lockedLetter) {
        cell.appendChild(makeTileDom(lockedLetter, false));
      } else if (state.pending.has(`${r},${c}`)) {
        const { letter } = state.pending.get(`${r},${c}`);
        const tile = makeTileDom(letter, true);
        if (isOurTurn()) {
          tile.draggable = true;
          tile.addEventListener("dragstart", (e) => {
            dragSource = { kind: "board", row: r, col: c };
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", "tile");
            tile.classList.add("dragging");
          });
          tile.addEventListener("dragend", () => {
            dragSource = null;
            tile.classList.remove("dragging");
            clearDropTargets();
          });
        }
        cell.appendChild(tile);
      }

      cell.addEventListener("click", () => onCellClick(r, c));
      cell.addEventListener("dragover", (e) => onCellDragOver(e, r, c, cell));
      cell.addEventListener("dragleave", () => cell.classList.remove("drop-target"));
      cell.addEventListener("drop", (e) => onCellDrop(e, r, c, cell));
      boardEl.appendChild(cell);
    }
  }
}

function makeTileDom(letter, fresh) {
  const t = document.createElement("div");
  t.classList.add("tile");
  if (fresh) t.classList.add("fresh");
  t.textContent = letter.toUpperCase();
  const v = document.createElement("span");
  v.classList.add("val");
  v.textContent = lv(letter);
  t.appendChild(v);
  return t;
}

function renderRack(s) {
  rackEl.innerHTML = "";
  const placedRackIndices = new Set(
    [...state.pending.values()].map((p) => p.rackIndex),
  );
  s.yourRack.forEach((letter, idx) => {
    const t = document.createElement("div");
    t.classList.add("tile");
    if (placedRackIndices.has(idx)) t.classList.add("placed");
    if (state.selectedRackIndex === idx) t.classList.add("selected");
    if (state.exchangeSelection.has(idx)) t.classList.add("exchange-marked");
    t.textContent = letter;
    const v = document.createElement("span");
    v.classList.add("val");
    v.textContent = lv(letter);
    t.appendChild(v);
    t.addEventListener("click", (e) => {
      if (e.shiftKey) {
        if (state.exchangeSelection.has(idx)) state.exchangeSelection.delete(idx);
        else state.exchangeSelection.add(idx);
      } else if (placedRackIndices.has(idx)) {
        // Recall this tile from the board.
        for (const [k, p] of state.pending) {
          if (p.rackIndex === idx) state.pending.delete(k);
        }
      } else {
        state.selectedRackIndex = state.selectedRackIndex === idx ? null : idx;
      }
      render();
    });

    if (isOurTurn() && !placedRackIndices.has(idx)) {
      t.draggable = true;
      t.addEventListener("dragstart", (e) => {
        dragSource = { kind: "rack", index: idx };
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", "tile");
        t.classList.add("dragging");
      });
      t.addEventListener("dragend", () => {
        dragSource = null;
        t.classList.remove("dragging");
        clearDropTargets();
      });
    }

    rackEl.appendChild(t);
  });
}

function renderHistory(s) {
  historyEl.innerHTML = "";
  s.history.slice(-30).forEach((entry) => {
    const li = document.createElement("li");
    const words = entry.words.map((w) => `${w.word} (${w.points})`).join(", ");
    li.textContent = `${entry.player}: ${words} → ${entry.points} pts`;
    historyEl.appendChild(li);
  });
  historyEl.scrollTop = historyEl.scrollHeight;
}

// ---- Board interactions --------------------------------------------------

function onCellClick(r, c) {
  const s = state.serverState;
  if (!s || s.status !== "playing") return;
  if (s.currentTurn !== state.playerId) return;

  const key = `${r},${c}`;
  if (s.board[r][c] !== null) return; // locked tile

  if (state.pending.has(key)) {
    state.pending.delete(key);
    render();
    return;
  }

  if (state.selectedRackIndex === null) return;
  const rackIdx = state.selectedRackIndex;
  const used = new Set([...state.pending.values()].map((p) => p.rackIndex));
  if (used.has(rackIdx)) return;

  const letter = s.yourRack[rackIdx];
  state.pending.set(key, { rackIndex: rackIdx, letter });
  state.selectedRackIndex = pickNextUnusedRack(s, rackIdx, used);
  render();
}

// ---- Drag and drop ------------------------------------------------------

function clearDropTargets() {
  for (const el of document.querySelectorAll(".drop-target")) {
    el.classList.remove("drop-target");
  }
}

function onCellDragOver(e, r, c, cell) {
  if (!dragSource || !isOurTurn()) return;
  const s = state.serverState;
  if (!s || s.board[r][c] !== null) return; // locked square
  // Don't highlight the source cell when dragging a board tile onto itself.
  if (dragSource.kind === "board" && dragSource.row === r && dragSource.col === c) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  cell.classList.add("drop-target");
}

function onCellDrop(e, r, c, cell) {
  e.preventDefault();
  cell.classList.remove("drop-target");
  if (!dragSource || !isOurTurn()) return;
  const s = state.serverState;
  if (!s || s.board[r][c] !== null) return;
  const destKey = `${r},${c}`;

  if (dragSource.kind === "rack") {
    const rackIdx = dragSource.index;
    const used = new Set([...state.pending.values()].map((p) => p.rackIndex));
    if (used.has(rackIdx)) return;
    // If destination already holds a pending tile, recall it first.
    state.pending.delete(destKey);
    state.pending.set(destKey, { rackIndex: rackIdx, letter: s.yourRack[rackIdx] });
    state.selectedRackIndex = null;
  } else if (dragSource.kind === "board") {
    const srcKey = `${dragSource.row},${dragSource.col}`;
    if (srcKey === destKey) return;
    const moving = state.pending.get(srcKey);
    if (!moving) return;
    const displaced = state.pending.get(destKey); // swap if dest occupied
    state.pending.delete(srcKey);
    state.pending.set(destKey, moving);
    if (displaced) state.pending.set(srcKey, displaced);
  }
  render();
}

function onRackDragOver(e) {
  if (!dragSource || dragSource.kind !== "board" || !isOurTurn()) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  rackEl.classList.add("drop-target");
}

function onRackDrop(e) {
  e.preventDefault();
  rackEl.classList.remove("drop-target");
  if (!dragSource || dragSource.kind !== "board" || !isOurTurn()) return;
  const srcKey = `${dragSource.row},${dragSource.col}`;
  state.pending.delete(srcKey);
  render();
}

rackEl.addEventListener("dragover", onRackDragOver);
rackEl.addEventListener("dragleave", () => rackEl.classList.remove("drop-target"));
rackEl.addEventListener("drop", onRackDrop);

function pickNextUnusedRack(s, current, used) {
  const next = new Set(used);
  next.add(current);
  for (let i = 0; i < s.yourRack.length; i++) {
    if (!next.has(i)) return i;
  }
  return null;
}

// ---- Action buttons ------------------------------------------------------

$("recall-btn").addEventListener("click", () => {
  state.pending.clear();
  render();
});

$("shuffle-btn").addEventListener("click", () => {
  const s = state.serverState;
  if (!s) return;
  const rack = s.yourRack.slice();
  for (let i = rack.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rack[i], rack[j]] = [rack[j], rack[i]];
  }
  s.yourRack = rack;
  state.pending.clear();
  render();
});

$("play-btn").addEventListener("click", () => {
  if (state.pending.size === 0) {
    setMessage("Colocá al menos una ficha.", true);
    return;
  }
  const placements = [...state.pending.entries()].map(([key, val]) => {
    const [row, col] = key.split(",").map(Number);
    return { row, col, letter: val.letter };
  });
  socket.emit("game:play", { placements }, (resp) => {
    if (resp.ok) {
      const total = resp.words.map((w) => `${w.word}(${w.points})`).join(" + ");
      setMessage(`+${resp.score} pts: ${total}`);
      state.pending.clear();
    } else {
      setMessage(resp.error, true);
    }
  });
});

$("pass-btn").addEventListener("click", () => {
  socket.emit("game:pass", {}, (resp) => {
    if (!resp.ok) setMessage(resp.error, true);
    else setMessage("Pasaste el turno.");
  });
});

$("exchange-btn").addEventListener("click", () => {
  const indices = [...state.exchangeSelection];
  if (indices.length === 0) {
    setMessage("Marcá fichas con Shift+click para cambiarlas.", true);
    return;
  }
  socket.emit("game:exchange", { indices }, (resp) => {
    if (!resp.ok) setMessage(resp.error, true);
    else setMessage(`Cambiaste ${indices.length} ficha${indices.length === 1 ? "" : "s"}.`);
  });
});

$("start-btn").addEventListener("click", () => {
  socket.emit("lobby:start", {}, (resp) => {
    if (!resp.ok) setMessage(resp.error, true);
  });
});

$("chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("chat-input");
  const msg = input.value.trim();
  if (!msg) return;
  socket.emit("game:chat", { message: msg });
  input.value = "";
});

$("overlay-close").addEventListener("click", () => {
  overlay.classList.add("hidden");
});

// ---- Helpers -------------------------------------------------------------

function setMessage(text, isError = false) {
  playMsg.textContent = text;
  playMsg.classList.toggle("error", isError);
  setTimeout(() => {
    if (playMsg.textContent === text) {
      playMsg.textContent = "";
      playMsg.classList.remove("error");
    }
  }, 6000);
}

function showOverlay(s) {
  overlay.classList.remove("hidden");
  const winners = s.winnerIds
    .map((id) => s.players.find((p) => p.id === id)?.name ?? "—")
    .join(", ");
  $("winner-title").textContent =
    s.winnerIds.length === 1 ? `🏆 ${winners} gana!` : `Empate: ${winners}`;
  const list = $("final-scores");
  list.innerHTML = "";
  [...s.players]
    .sort((a, b) => b.score - a.score)
    .forEach((p) => {
      const li = document.createElement("li");
      li.textContent = `${p.name}: ${p.score} pts`;
      list.appendChild(li);
    });
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
