import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { GameRoom, RoomManager } from "../server/rooms.js";
import { InvalidPlayError } from "../server/engine.js";
import { RACK_SIZE } from "../server/bonuses.js";

function makeRoom({ language = "english", playerCount = 2 } = {}) {
  const room = new GameRoom({ id: "TEST", language });
  for (let i = 0; i < playerCount; i++) {
    room.addPlayer({ name: `P${i + 1}`, socketId: `s${i + 1}` });
  }
  return room;
}

async function startedRoom(opts) {
  const room = makeRoom(opts);
  // Inject a tiny synthetic dictionary so we control which words validate.
  await room.start();
  room.dictionary = new Set(["of", "ofs", "at", "ate", "go", "got"]);
  return room;
}

function setRack(room, idx, letters) {
  room.players[idx].rack = letters.slice();
}

describe("GameRoom — lobby", () => {
  it("addPlayer assigns a unique id and 0 score", () => {
    const room = makeRoom({ playerCount: 0 });
    const a = room.addPlayer({ name: "Alice", socketId: "s1" });
    const b = room.addPlayer({ name: "Bob", socketId: "s2" });
    assert.notEqual(a.id, b.id);
    assert.equal(a.score, 0);
    assert.equal(b.score, 0);
  });

  it("addPlayer caps the room at 4 players", () => {
    const room = makeRoom({ playerCount: 4 });
    assert.throws(() => room.addPlayer({ name: "X", socketId: "x" }));
  });

  it("removePlayer in lobby drops the player", () => {
    const room = makeRoom({ playerCount: 2 });
    const target = room.players[0];
    room.removePlayer(target.id);
    assert.equal(room.players.length, 1);
  });

  it("removePlayer mid-game just marks the player offline", async () => {
    const room = await startedRoom({ playerCount: 2 });
    const target = room.players[0];
    room.removePlayer(target.id);
    assert.equal(room.players.length, 2);
    assert.equal(room.players[0].connected, false);
  });

  it("setSocket reattaches a player on reconnect", async () => {
    const room = await startedRoom({ playerCount: 2 });
    const p = room.players[0];
    room.removePlayer(p.id);
    const recovered = room.setSocket(p.id, "newsocket");
    assert.equal(recovered.socketId, "newsocket");
    assert.equal(recovered.connected, true);
  });
});

describe("GameRoom — start()", () => {
  it("requires at least 2 players", async () => {
    const room = makeRoom({ playerCount: 1 });
    await assert.rejects(() => room.start(), /al menos 2/i);
  });

  it("deals 7 tiles to each player and sets status=playing", async () => {
    const room = makeRoom({ playerCount: 3 });
    await room.start();
    assert.equal(room.status, "playing");
    for (const p of room.players) assert.equal(p.rack.length, RACK_SIZE);
  });

  it("cannot start twice", async () => {
    const room = await startedRoom();
    await assert.rejects(() => room.start());
  });
});

describe("GameRoom — turns", () => {
  it("currentPlayer is the first one to start", async () => {
    const room = await startedRoom();
    assert.equal(room.currentPlayer().id, room.players[0].id);
  });

  it("playMove advances the turn", async () => {
    const room = await startedRoom();
    setRack(room, 0, ["O", "F", "X", "X", "X", "X", "X"]);
    room.playMove(room.players[0].id, [
      { row: 7, col: 7, letter: "O" },
      { row: 7, col: 8, letter: "F" },
    ]);
    assert.equal(room.currentPlayer().id, room.players[1].id);
  });

  it("playMove off-turn throws", async () => {
    const room = await startedRoom();
    setRack(room, 1, ["O", "F", "X", "X", "X", "X", "X"]);
    assert.throws(
      () =>
        room.playMove(room.players[1].id, [
          { row: 7, col: 7, letter: "O" },
          { row: 7, col: 8, letter: "F" },
        ]),
      InvalidPlayError,
    );
  });

  it("playMove credits the player and refills the rack to 7", async () => {
    const room = await startedRoom();
    setRack(room, 0, ["O", "F", "X", "X", "X", "X", "X"]);
    const before = room.bag.length;
    room.playMove(room.players[0].id, [
      { row: 7, col: 7, letter: "O" },
      { row: 7, col: 8, letter: "F" },
    ]);
    const p = room.players[0];
    assert.ok(p.score > 0);
    assert.equal(p.rack.length, RACK_SIZE);
    assert.equal(room.bag.length, before - 2);
  });

  it("history is appended after each play", async () => {
    const room = await startedRoom();
    setRack(room, 0, ["O", "F", "X", "X", "X", "X", "X"]);
    room.playMove(room.players[0].id, [
      { row: 7, col: 7, letter: "O" },
      { row: 7, col: 8, letter: "F" },
    ]);
    assert.equal(room.history.length, 1);
    assert.equal(room.history[0].playerId, room.players[0].id);
  });
});

describe("GameRoom — pass()", () => {
  it("advances the turn", async () => {
    const room = await startedRoom();
    room.pass(room.players[0].id);
    assert.equal(room.currentPlayer().id, room.players[1].id);
  });

  it("ends the game after 6 consecutive passes", async () => {
    const room = await startedRoom();
    for (let i = 0; i < 6; i++) {
      room.pass(room.currentPlayer().id);
    }
    assert.equal(room.status, "over");
    assert.ok(room.winnerIds.length >= 1);
  });

  it("a successful play resets the pass counter", async () => {
    const room = await startedRoom();
    room.pass(room.players[0].id);
    setRack(room, 1, ["O", "F", "X", "X", "X", "X", "X"]);
    room.playMove(room.players[1].id, [
      { row: 7, col: 7, letter: "O" },
      { row: 7, col: 8, letter: "F" },
    ]);
    assert.equal(room.consecutivePasses, 0);
  });
});

describe("GameRoom — exchange()", () => {
  it("swaps the chosen rack tiles for new ones", async () => {
    const room = await startedRoom();
    setRack(room, 0, ["A", "B", "C", "D", "E", "F", "G"]);
    const before = room.players[0].rack.slice();
    room.exchange(room.players[0].id, [0, 1]);
    const after = room.players[0].rack;
    assert.equal(after.length, RACK_SIZE);
    // The old A/B might have been re-shuffled into the bag and back, but at
    // minimum the rack should have changed in some way relative to the
    // suffix that wasn't exchanged.
    assert.deepEqual(after.slice(0, 5), before.slice(2));
  });

  it("refuses when the bag has fewer than 7 tiles", async () => {
    const room = await startedRoom();
    room.bag = ["A", "B", "C"];
    setRack(room, 0, ["A", "B", "C", "D", "E", "F", "G"]);
    assert.throws(
      () => room.exchange(room.players[0].id, [0]),
      InvalidPlayError,
    );
  });

  it("refuses an empty selection", async () => {
    const room = await startedRoom();
    assert.throws(
      () => room.exchange(room.players[0].id, []),
      InvalidPlayError,
    );
  });
});

describe("GameRoom — endgame scoring", () => {
  it("declares a winner when bag is empty and a player empties their rack", async () => {
    const room = await startedRoom();
    // Force an end-of-game scenario:
    room.bag = []; // bag is empty
    setRack(room, 0, ["O", "F"]);              // exactly the tiles to play
    setRack(room, 1, ["X", "X", "X"]);         // remaining = 8*3 = 24
    room.playMove(room.players[0].id, [
      { row: 7, col: 7, letter: "O" },
      { row: 7, col: 8, letter: "F" },
    ]);
    assert.equal(room.status, "over");
    assert.equal(room.players[0].rack.length, 0);
    // Player 0 gets the OF score plus the sum of opponent rack values (24);
    // Player 1 loses 24.
    assert.equal(room.players[1].score, -24);
    const top = Math.max(...room.players.map((p) => p.score));
    assert.deepEqual(room.winnerIds, [room.players[0].id]);
    assert.equal(room.players[0].score, top);
  });
});

describe("RoomManager", () => {
  it("create() makes a fresh room with a unique id", () => {
    const mgr = new RoomManager();
    const a = mgr.create({ language: "english" });
    const b = mgr.create({ language: "english" });
    assert.notEqual(a.id, b.id);
    assert.equal(mgr.get(a.id), a);
  });

  it("delete() removes the room", () => {
    const mgr = new RoomManager();
    const r = mgr.create({ language: "english" });
    mgr.delete(r.id);
    assert.equal(mgr.get(r.id), null);
  });
});
