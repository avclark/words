import { Router } from "express";
import { db } from "@workspace/db";
import { gameChatTable, gamePlayersTable, usersTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../middlewares/authenticate";
import { generateId } from "../lib/auth";
import { notifyChat } from "../lib/notifications";
import { emitChatMessage } from "../lib/websocket";

const router = Router();

router.get("/games/:gameId/chat", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { gameId } = req.params as { gameId: string };

  const players = await db
    .select()
    .from(gamePlayersTable)
    .where(eq(gamePlayersTable.gameId, gameId));

  if (!players.some((p) => p.userId === userId)) {
    res.status(403).json({ error: "Not a player in this game" });
    return;
  }

  const messages = await db
    .select()
    .from(gameChatTable)
    .where(eq(gameChatTable.gameId, gameId))
    .orderBy(desc(gameChatTable.createdAt))
    .limit(100);

  const userMap = new Map<string, { username: string; avatarUrl: string | null }>();
  for (const msg of messages) {
    if (!userMap.has(msg.userId)) {
      const [u] = await db
        .select({ username: usersTable.username, avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(eq(usersTable.id, msg.userId))
        .limit(1);
      if (u) userMap.set(msg.userId, u);
    }
  }

  res.json(
    messages.reverse().map((m) => ({
      id: m.id,
      gameId: m.gameId,
      userId: m.userId,
      username: userMap.get(m.userId)?.username ?? "",
      avatarUrl: userMap.get(m.userId)?.avatarUrl ?? null,
      message: m.message,
      createdAt: m.createdAt.toISOString(),
    }))
  );
});

router.post("/games/:gameId/chat", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { gameId } = req.params as { gameId: string };
  const { message } = req.body as { message?: string };

  if (!message || message.trim().length === 0) {
    res.status(400).json({ error: "Message cannot be empty" });
    return;
  }
  if (message.length > 500) {
    res.status(400).json({ error: "Message too long" });
    return;
  }

  const players = await db
    .select()
    .from(gamePlayersTable)
    .where(eq(gamePlayersTable.gameId, gameId));

  if (!players.some((p) => p.userId === userId)) {
    res.status(403).json({ error: "Not a player in this game" });
    return;
  }

  const [sender] = await db
    .select({ username: usersTable.username, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const [chatMsg] = await db
    .insert(gameChatTable)
    .values({
      id: generateId(),
      gameId,
      userId,
      message: message.trim(),
    })
    .returning();

  const formatted = {
    id: chatMsg!.id,
    gameId: chatMsg!.gameId,
    userId: chatMsg!.userId,
    username: sender?.username ?? "",
    avatarUrl: sender?.avatarUrl ?? null,
    message: chatMsg!.message,
    createdAt: chatMsg!.createdAt.toISOString(),
  };

  // Emit to WebSocket room
  emitChatMessage(gameId, formatted);

  // Notify opponent if they have chat notifications enabled
  const opponent = players.find((p) => p.userId !== userId);
  if (opponent) {
    const [oppUser] = await db
      .select({ pushToken: usersTable.pushToken, notificationChat: usersTable.notificationChat })
      .from(usersTable)
      .where(eq(usersTable.id, opponent.userId))
      .limit(1);
    if (oppUser?.notificationChat) {
      const preview = message.length > 50 ? message.slice(0, 47) + "..." : message;
      await notifyChat(oppUser.pushToken, sender?.username ?? "Player", preview);
    }
  }

  res.status(201).json(formatted);
});

export default router;
