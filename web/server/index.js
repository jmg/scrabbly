import express from "express";
import { Server } from "socket.io";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { RoomManager } from "./rooms.js";
import { InvalidPlayError } from "./engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const PORT = process.env.PORT ?? 3000;
const SUPPORTED_LANGUAGES = new Set(["english", "spanish"]);

const app = express();
app.use(express.static(PUBLIC_DIR));
app.get("/health", (_, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
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
      if (!SUPPORTED_LANGUAGES.has(language)) {
        throw new Error("Idioma no soportado.");
      }
      const room = rooms.create({ language });
      const player = room.addPlayer({ name, socketId: socket.id });
      joinedRoomId = room.id;
      playerId = player.id;
      socket.join(room.id);
      ack?.({ ok: true, roomId: room.id, playerId: player.id });
      broadcastState(room.id);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("lobby:join", ({ name, roomId }, ack) => {
    try {
      const room = rooms.get(roomId?.toUpperCase?.() ?? roomId);
      if (!room) throw new Error("La sala no existe.");
      const player = room.addPlayer({ name, socketId: socket.id });
      joinedRoomId = room.id;
      playerId = player.id;
      socket.join(room.id);
      ack?.({ ok: true, roomId: room.id, playerId: player.id });
      broadcastState(room.id);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("lobby:rejoin", ({ roomId, playerId: pid }, ack) => {
    try {
      const room = rooms.get(roomId);
      if (!room) throw new Error("La sala no existe.");
      const player = room.setSocket(pid, socket.id);
      if (!player) throw new Error("Ese jugador no está en la sala.");
      joinedRoomId = room.id;
      playerId = player.id;
      socket.join(room.id);
      ack?.({ ok: true, roomId: room.id, playerId: player.id });
      broadcastState(room.id);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("lobby:start", async (_, ack) => {
    try {
      if (!joinedRoomId) throw new Error("No estás en una sala.");
      const room = rooms.get(joinedRoomId);
      if (!room) throw new Error("Sala no encontrada.");
      await room.start();
      ack?.({ ok: true });
      broadcastState(room.id);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("game:play", ({ placements }, ack) => {
    try {
      if (!joinedRoomId || !playerId) throw new Error("No estás en una partida.");
      const room = rooms.get(joinedRoomId);
      if (!room) throw new Error("Sala no encontrada.");
      const result = room.playMove(playerId, placements);
      ack?.({ ok: true, score: result.score, words: result.words });
      broadcastState(room.id);
    } catch (err) {
      const isPlay = err instanceof InvalidPlayError;
      ack?.({ ok: false, error: err.message, kind: isPlay ? "play" : "system" });
    }
  });

  socket.on("game:pass", (_, ack) => {
    try {
      const room = rooms.get(joinedRoomId);
      if (!room) throw new Error("Sala no encontrada.");
      room.pass(playerId);
      ack?.({ ok: true });
      broadcastState(room.id);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("game:exchange", ({ indices }, ack) => {
    try {
      const room = rooms.get(joinedRoomId);
      if (!room) throw new Error("Sala no encontrada.");
      room.exchange(playerId, indices);
      ack?.({ ok: true });
      broadcastState(room.id);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("game:chat", ({ message }) => {
    if (!joinedRoomId) return;
    const room = rooms.get(joinedRoomId);
    const me = room?.players.find((p) => p.id === playerId);
    if (!room || !me) return;
    const text = String(message ?? "").slice(0, 200);
    if (!text.trim()) return;
    io.to(room.id).emit("game:chat", { from: me.name, message: text });
  });

  socket.on("disconnect", () => {
    if (!joinedRoomId || !playerId) return;
    const room = rooms.get(joinedRoomId);
    if (!room) return;
    room.removePlayer(playerId);
    if (room.status === "waiting" && room.players.length === 0) {
      rooms.delete(room.id);
      return;
    }
    broadcastState(room.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Scrabbly web listening on http://localhost:${PORT}`);
});
