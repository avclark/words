import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { verifyToken } from "./auth";
import { logger } from "./logger";

let io: SocketIOServer | null = null;

export function initWebSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth["token"] as string | undefined;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    const payload = verifyToken(token);
    if (!payload) {
      return next(new Error("Invalid token"));
    }
    (socket as unknown as Record<string, unknown>)["userId"] = payload.userId;
    next();
  });

  io.on("connection", (socket) => {
    const userId = (socket as unknown as Record<string, unknown>)["userId"] as string;
    logger.info({ userId, socketId: socket.id }, "WebSocket connected");

    socket.on("join_game", (gameId: string) => {
      socket.join(`game:${gameId}`);
      logger.info({ userId, gameId }, "Joined game room");
    });

    socket.on("leave_game", (gameId: string) => {
      socket.leave(`game:${gameId}`);
    });

    socket.on("disconnect", () => {
      logger.info({ userId, socketId: socket.id }, "WebSocket disconnected");
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitGameUpdate(gameId: string, event: string, data: unknown): void {
  if (!io) return;
  io.to(`game:${gameId}`).emit(event, data);
}

export function emitChatMessage(gameId: string, message: unknown): void {
  emitGameUpdate(gameId, "chat_message", message);
}

export function emitGameStateUpdate(gameId: string, gameState: unknown): void {
  emitGameUpdate(gameId, "game_updated", gameState);
}
