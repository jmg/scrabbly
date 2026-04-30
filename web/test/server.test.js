import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

import express from "express";
import { Server } from "socket.io";
import { io as Client } from "socket.io-client";

import { RoomManager } from "../server/rooms.js";
import { InvalidPlayError } from "../server/engine.js";

// We don't import the real entrypoint because it auto-listens on a fixed port
// and starts up the static handler. Instead we wire up the same socket
// handlers against a fresh server bound to an ephemeral port.

function buildServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const rooms = new RoomManager();

  function broadcastState(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    for (const p of room.players) {
      if (!p.connected) continue;
      io.to(p.socketId).emit("game:state", room.publicState(p.id));
    }
  }

  io.on("connection", (socket) => {
    let joinedRoomId = null;
    let playerId = null;

    socket.on("lobby:create", async ({ name, language }, ack) => {
      try {
        const room = rooms.create({ language });
        const player = room.addPlayer({ name, socketId: socket.id });
        joinedRoomId = room.id;
        playerId = player.id;
        socket.join(room.id);
        ack({ ok: true, roomId: room.id, playerId: player.id });
        broadcastState(room.id);
      } catch (err) {
        ack({ ok: false, error: err.message });
      }
    });

    socket.on("lobby:join", ({ name, roomId }, ack) => {
      try {
        const room = rooms.get(roomId);
        if (!room) throw new Error("La sala no existe.");
        const player = room.addPlayer({ name, socketId: socket.id });
        joinedRoomId = room.id;
        playerId = player.id;
        socket.join(room.id);
        ack({ ok: true, roomId: room.id, playerId: player.id });
        broadcastState(room.id);
      } catch (err) {
        ack({ ok: false, error: err.message });
      }
    });

    socket.on("lobby:start", async (_, ack) => {
      try {
        const room = rooms.get(joinedRoomId);
        await room.start();
        // Override dictionary so we can drive deterministic plays.
        room.dictionary = new Set(["of", "ofs", "at"]);
        // Force racks for predictable testing.
        room.players[0].rack = ["O", "F", "S", "X", "Y", "Z", "Q"];
        room.players[1].rack = ["A", "T", "Q", "Q", "Q", "Q", "Q"];
        ack({ ok: true });
        broadcastState(room.id);
      } catch (err) {
        ack({ ok: false, error: err.message });
      }
    });

    socket.on("game:play", ({ placements }, ack) => {
      try {
        const room = rooms.get(joinedRoomId);
        const result = room.playMove(playerId, placements);
        ack({ ok: true, score: result.score, words: result.words });
        broadcastState(room.id);
      } catch (err) {
        ack({
          ok: false,
          error: err.message,
          kind: err instanceof InvalidPlayError ? "play" : "system",
        });
      }
    });

    socket.on("game:pass", (_, ack) => {
      try {
        const room = rooms.get(joinedRoomId);
        room.pass(playerId);
        ack({ ok: true });
        broadcastState(room.id);
      } catch (err) {
        ack({ ok: false, error: err.message });
      }
    });
  });

  return { httpServer, io };
}

let httpServer;
let port;
let ioServer;
const openClients = new Set();

function makeClient() {
  const c = Client(`http://localhost:${port}`, {
    transports: ["websocket"],
    forceNew: true,
  });
  openClients.add(c);
  return c;
}

function closeClient(c) {
  openClients.delete(c);
  c.disconnect();
}

function emit(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

function awaitState(socket, predicate = () => true) {
  return new Promise((resolve) => {
    const handler = (s) => {
      if (predicate(s)) {
        socket.off("game:state", handler);
        resolve(s);
      }
    };
    socket.on("game:state", handler);
  });
}

before(async () => {
  const built = buildServer();
  httpServer = built.httpServer;
  ioServer = built.io;
  await new Promise((resolve) => httpServer.listen(0, resolve));
  port = httpServer.address().port;
});

after(async () => {
  for (const c of openClients) c.disconnect();
  openClients.clear();
  await new Promise((resolve) => ioServer.close(() => resolve()));
});

describe("socket.io server — happy path", () => {
  it("creates a room, joins, starts, plays a valid move", async () => {
    const a = makeClient();
    const b = makeClient();
    await Promise.all([
      new Promise((r) => a.once("connect", r)),
      new Promise((r) => b.once("connect", r)),
    ]);

    const create = await emit(a, "lobby:create", {
      name: "Alice",
      language: "english",
    });
    assert.equal(create.ok, true);
    assert.ok(create.roomId);

    const join = await emit(b, "lobby:join", {
      name: "Bob",
      roomId: create.roomId,
    });
    assert.equal(join.ok, true);

    const playingState = awaitState(a, (s) => s.status === "playing");
    const start = await emit(a, "lobby:start", {});
    assert.equal(start.ok, true);
    const aState = await playingState;
    assert.equal(aState.status, "playing");
    assert.equal(aState.players.length, 2);

    const play = await emit(a, "game:play", {
      placements: [
        { row: 7, col: 7, letter: "O" },
        { row: 7, col: 8, letter: "F" },
      ],
    });
    assert.equal(play.ok, true, `play failed: ${play.error}`);
    assert.equal(play.score, 10); // OF on center DW: (1+4)*2

    closeClient(a);
    closeClient(b);
  });
});

describe("socket.io server — error paths", () => {
  it("rejects joining a non-existent room", async () => {
    const c = makeClient();
    await new Promise((r) => c.once("connect", r));
    const resp = await emit(c, "lobby:join", { name: "Z", roomId: "ZZZZZ" });
    assert.equal(resp.ok, false);
    assert.match(resp.error, /no existe/i);
    closeClient(c);
  });

  it("rejects an off-turn play", async () => {
    const a = makeClient();
    const b = makeClient();
    await Promise.all([
      new Promise((r) => a.once("connect", r)),
      new Promise((r) => b.once("connect", r)),
    ]);
    const create = await emit(a, "lobby:create", {
      name: "Alice",
      language: "english",
    });
    await emit(b, "lobby:join", { name: "Bob", roomId: create.roomId });

    const playingState = awaitState(a, (s) => s.status === "playing");
    await emit(a, "lobby:start", {});
    await playingState;

    // Bob is not the first player; his attempt must be rejected.
    const resp = await emit(b, "game:play", {
      placements: [{ row: 7, col: 7, letter: "A" }],
    });
    assert.equal(resp.ok, false);
    assert.equal(resp.kind, "play");
    assert.match(resp.error, /tu turno/i);

    closeClient(a);
    closeClient(b);
  });

  it("broadcasts updated state to both players after a play", async () => {
    const a = makeClient();
    const b = makeClient();
    await Promise.all([
      new Promise((r) => a.once("connect", r)),
      new Promise((r) => b.once("connect", r)),
    ]);
    const create = await emit(a, "lobby:create", {
      name: "Alice",
      language: "english",
    });
    await emit(b, "lobby:join", { name: "Bob", roomId: create.roomId });

    const aPlaying = awaitState(a, (s) => s.status === "playing");
    const bPlaying = awaitState(b, (s) => s.status === "playing");
    await emit(a, "lobby:start", {});
    await Promise.all([aPlaying, bPlaying]);

    const aAfterPlay = awaitState(a, (s) => s.board[7][7] !== null);
    const bAfterPlay = awaitState(b, (s) => s.board[7][7] !== null);
    const play = await emit(a, "game:play", {
      placements: [
        { row: 7, col: 7, letter: "O" },
        { row: 7, col: 8, letter: "F" },
      ],
    });
    assert.equal(play.ok, true);
    const [as, bs] = await Promise.all([aAfterPlay, bAfterPlay]);
    assert.equal(as.board[7][7], "O");
    assert.equal(bs.board[7][7], "O");
    // Each player only sees their own rack. Bob hasn't played yet, so his
    // rack is exactly what we forced. Alice played 2 tiles and was refilled,
    // so the 5 leftovers from her starting rack must still be present.
    assert.equal(as.yourRack.length, 7);
    assert.deepEqual(
      bs.yourRack.slice().sort(),
      ["A", "Q", "Q", "Q", "Q", "Q", "T"],
    );
    for (const leftover of ["S", "X", "Y", "Z", "Q"]) {
      assert.ok(
        as.yourRack.includes(leftover),
        `Alice's rack should still contain ${leftover}`,
      );
    }

    closeClient(a);
    closeClient(b);
  });
});
