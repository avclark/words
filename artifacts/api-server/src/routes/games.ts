import { Router } from "express";
import { db } from "@workspace/db";
import {
  gamesTable,
  gameMovesTable,
  gamePlayersTable,
  usersTable,
  friendshipsTable,
} from "@workspace/db";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../middlewares/authenticate";
import { generateId } from "../lib/auth";
import { notifyTurn } from "../lib/notifications";
import { emitGameStateUpdate } from "../lib/websocket";
import {
  applyMove,
  calculateFinalScores,
  calculateScore,
  createEmptyBoard,
  findBestWord,
  findWordsFormed,
  getWordStrength,
  isGameOver,
  validateMove,
  validateWords,
} from "../lib/scrabble/board";
import { createBag, fillRack, swapTiles } from "../lib/scrabble/bag";
import { TURN_DEADLINE_HOURS } from "../lib/scrabble/constants";
import type { BoardCell, PlacedTile } from "../lib/scrabble/constants";

const router = Router();

function makeTurnDeadline(): Date {
  const d = new Date();
  d.setHours(d.getHours() + TURN_DEADLINE_HOURS);
  return d;
}

async function buildGameState(
  game: typeof gamesTable.$inferSelect,
  players: (typeof gamePlayersTable.$inferSelect)[],
  requestingUserId: string
): Promise<Record<string, unknown>> {
  const userIds = players.map((p) => p.userId);
  const usersData = await Promise.all(
    userIds.map((uid) =>
      db
        .select({ id: usersTable.id, username: usersTable.username, avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(eq(usersTable.id, uid))
        .limit(1)
        .then((r) => r[0])
    )
  );

  const myPlayer = players.find((p) => p.userId === requestingUserId);
  const currentPlayerUserId = players.find(
    (p) => p.playerIndex === game.currentPlayerIndex
  )?.userId;

  return {
    id: game.id,
    status: game.status,
    board: game.boardState,
    players: players.map((p, i) => ({
      userId: p.userId,
      username: usersData[i]?.username ?? "",
      avatarUrl: usersData[i]?.avatarUrl ?? null,
      score: p.score,
      rackSize: (p.rack as string[]).length,
      isCurrentTurn: p.userId === currentPlayerUserId,
    })),
    myRack: myPlayer ? (myPlayer.rack as string[]) : [],
    bagSize: (game.bagTiles as string[]).length,
    consecutivePasses: game.consecutivePasses,
    turnDeadlineAt: game.turnDeadlineAt?.toISOString() ?? null,
    winnerId: game.winnerId,
    rematchGameId: game.rematchGameId ?? null,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  };
}

router.get("/games", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;

  const myPlayers = await db
    .select()
    .from(gamePlayersTable)
    .where(eq(gamePlayersTable.userId, userId));

  const gameIds = myPlayers.map((p) => p.gameId);
  if (gameIds.length === 0) {
    res.json([]);
    return;
  }

  const summaries = await Promise.all(
    gameIds.map(async (gid) => {
      const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gid)).limit(1);
      if (!game) return null;
      const players = await db.select().from(gamePlayersTable).where(eq(gamePlayersTable.gameId, gid));
      const myP = players.find((p) => p.userId === userId);
      const oppP = players.find((p) => p.userId !== userId);
      if (!myP || !oppP) return null;
      const [opp] = await db
        .select({ id: usersTable.id, username: usersTable.username, avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(eq(usersTable.id, oppP.userId))
        .limit(1);
      const currentPlayerId = players.find((p) => p.playerIndex === game.currentPlayerIndex)?.userId;
      return {
        id: game.id,
        status: game.status,
        opponent: opp ? { id: opp.id, username: opp.username, avatarUrl: opp.avatarUrl } : null,
        myScore: myP.score,
        opponentScore: oppP.score,
        isMyTurn: currentPlayerId === userId && game.status === "active",
        turnDeadlineAt: game.turnDeadlineAt?.toISOString() ?? null,
        winnerId: game.winnerId,
        updatedAt: game.updatedAt.toISOString(),
      };
    })
  );

  res.json(summaries.filter(Boolean).sort((a, b) => {
    if (!a || !b) return 0;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  }));
});

router.post("/games", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { opponentId } = req.body as { opponentId?: string };

  if (!opponentId) {
    res.status(400).json({ error: "opponentId is required" });
    return;
  }
  if (opponentId === userId) {
    res.status(400).json({ error: "Cannot play against yourself" });
    return;
  }

  const [opponent] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, opponentId))
    .limit(1);

  if (!opponent) {
    res.status(404).json({ error: "Opponent not found" });
    return;
  }

  const bag = createBag();
  const emptyBoard = createEmptyBoard();

  const { newRack: rack0, newBag: bag1 } = fillRack([], bag);
  const { newRack: rack1, newBag: finalBag } = fillRack([], bag1);

  const firstPlayerIndex = Math.random() < 0.5 ? 0 : 1;
  const gameId = generateId();

  const [game] = await db
    .insert(gamesTable)
    .values({
      id: gameId,
      status: "active",
      boardState: emptyBoard,
      bagTiles: finalBag,
      currentPlayerIndex: firstPlayerIndex,
      consecutivePasses: 0,
      turnDeadlineAt: makeTurnDeadline(),
    })
    .returning();

  const players = firstPlayerIndex === 0
    ? [{ userId, rack: rack0, index: 0 }, { userId: opponentId, rack: rack1, index: 1 }]
    : [{ userId: opponentId, rack: rack0, index: 0 }, { userId, rack: rack1, index: 1 }];

  for (const p of players) {
    await db.insert(gamePlayersTable).values({
      id: generateId(),
      gameId,
      userId: p.userId,
      rack: p.rack,
      score: 0,
      playerIndex: p.index,
    });
  }

  const gamePlayers = await db
    .select()
    .from(gamePlayersTable)
    .where(eq(gamePlayersTable.gameId, gameId));

  const state = await buildGameState(game!, gamePlayers, userId);
  res.status(201).json(state);
});

router.get("/games/:gameId", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { gameId } = req.params as { gameId: string };

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId)).limit(1);
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  const players = await db.select().from(gamePlayersTable).where(eq(gamePlayersTable.gameId, gameId));
  const isPlayer = players.some((p) => p.userId === userId);
  if (!isPlayer) {
    res.status(403).json({ error: "Not a player in this game" });
    return;
  }

  const state = await buildGameState(game, players, userId);
  res.json(state);
});

router.post("/games/:gameId/move", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { gameId } = req.params as { gameId: string };
  const { tiles } = req.body as { tiles?: PlacedTile[] };

  if (!tiles || !Array.isArray(tiles) || tiles.length === 0) {
    res.status(400).json({ error: "tiles array is required" });
    return;
  }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId)).limit(1);
  if (!game || game.status !== "active") {
    res.status(400).json({ error: "Game not found or not active" });
    return;
  }

  const players = await db.select().from(gamePlayersTable).where(eq(gamePlayersTable.gameId, gameId));
  const myPlayer = players.find((p) => p.userId === userId);
  if (!myPlayer) {
    res.status(403).json({ error: "Not a player" });
    return;
  }

  const currentPlayer = players.find((p) => p.playerIndex === game.currentPlayerIndex);
  if (currentPlayer?.userId !== userId) {
    res.status(400).json({ error: "Not your turn" });
    return;
  }

  const board = game.boardState as BoardCell[][];
  const rack = myPlayer.rack as string[];
  const isFirstMove = board.every((row) => row.every((cell) => cell.letter === null));

  // Validate the move structure
  const validation = validateMove(board, tiles, isFirstMove);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  // Verify player has these tiles in rack
  const rackCopy = [...rack];
  for (const t of tiles) {
    const tileToUse = t.isBlank ? "?" : t.letter.toUpperCase();
    const idx = rackCopy.indexOf(tileToUse);
    if (idx === -1) {
      res.status(400).json({ error: `Tile ${t.letter} not in rack` });
      return;
    }
    rackCopy.splice(idx, 1);
  }

  // Find and validate words
  const words = findWordsFormed(board, tiles);
  if (words.length === 0) {
    res.status(400).json({ error: "No valid word formed" });
    return;
  }
  const wordValidation = validateWords(words);
  if (!wordValidation.valid) {
    res.status(400).json({ error: `"${wordValidation.invalid}" is not a valid word` });
    return;
  }

  const score = calculateScore(board, tiles);
  const newBoard = applyMove(board, tiles, userId);

  // Draw new tiles
  const bag = game.bagTiles as string[];
  const { newRack, newBag } = fillRack(rackCopy, bag);

  const nextPlayerIndex = game.currentPlayerIndex === 0 ? 1 : 0;

  // Check game over
  const otherPlayer = players.find((p) => p.playerIndex === nextPlayerIndex);
  const otherRack = otherPlayer ? (otherPlayer.rack as string[]) : [];
  const gameOver = isGameOver(newBag, [newRack, otherRack], 0);

  let finalScores: number[] | null = null;
  let winnerId: string | null = null;

  if (gameOver) {
    const allScores = players.map((p) => p.score);
    allScores[myPlayer.playerIndex] = myPlayer.score + score;
    const racks = [newRack, otherRack];
    finalScores = calculateFinalScores(allScores, racks);
    const maxScore = Math.max(...finalScores);
    const winnerIdx = finalScores.indexOf(maxScore);
    winnerId = players[winnerIdx]?.userId ?? null;
  }

  // Save move
  await db.insert(gameMovesTable).values({
    id: generateId(),
    gameId,
    userId,
    moveType: "place",
    tilesPlaced: tiles,
    wordsFormed: words,
    score,
  });

  // Update player rack and score
  await db
    .update(gamePlayersTable)
    .set({ rack: newRack, score: myPlayer.score + score })
    .where(and(eq(gamePlayersTable.gameId, gameId), eq(gamePlayersTable.userId, userId)));

  // Update game state
  const [updatedGame] = await db
    .update(gamesTable)
    .set({
      boardState: newBoard,
      bagTiles: newBag,
      currentPlayerIndex: gameOver ? game.currentPlayerIndex : nextPlayerIndex,
      consecutivePasses: 0,
      status: gameOver ? "finished" : "active",
      winnerId: winnerId,
      turnDeadlineAt: gameOver ? null : makeTurnDeadline(),
      updatedAt: new Date(),
    })
    .where(eq(gamesTable.id, gameId))
    .returning();

  if (gameOver && finalScores) {
    for (let i = 0; i < players.length; i++) {
      await db
        .update(gamePlayersTable)
        .set({ score: finalScores[i] })
        .where(and(eq(gamePlayersTable.gameId, gameId), eq(gamePlayersTable.userId, players[i]!.userId)));
    }
  }

  const updatedPlayers = await db
    .select()
    .from(gamePlayersTable)
    .where(eq(gamePlayersTable.gameId, gameId));

  const state = await buildGameState(updatedGame!, updatedPlayers, userId);
  emitGameStateUpdate(gameId, state);

  // Notify opponent
  if (!gameOver && otherPlayer) {
    const [myUser] = await db
      .select({ username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    const [oppUser] = await db
      .select({ pushToken: usersTable.pushToken, notificationTurn: usersTable.notificationTurn })
      .from(usersTable)
      .where(eq(usersTable.id, otherPlayer.userId))
      .limit(1);
    if (oppUser?.notificationTurn) {
      await notifyTurn(oppUser.pushToken, myUser?.username ?? "Opponent");
    }
  }

  res.json({
    success: true,
    gameState: state,
    wordsFormed: words,
    score,
    message: gameOver ? "Game over!" : null,
  });
});

router.post("/games/:gameId/swap", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { gameId } = req.params as { gameId: string };
  const { letters } = req.body as { letters?: string[] };

  if (!letters || letters.length === 0) {
    res.status(400).json({ error: "letters array is required" });
    return;
  }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId)).limit(1);
  if (!game || game.status !== "active") {
    res.status(400).json({ error: "Game not active" });
    return;
  }

  const players = await db.select().from(gamePlayersTable).where(eq(gamePlayersTable.gameId, gameId));
  const myPlayer = players.find((p) => p.userId === userId);
  if (!myPlayer) {
    res.status(403).json({ error: "Not a player" });
    return;
  }
  const currentPlayer = players.find((p) => p.playerIndex === game.currentPlayerIndex);
  if (currentPlayer?.userId !== userId) {
    res.status(400).json({ error: "Not your turn" });
    return;
  }

  const rack = myPlayer.rack as string[];
  const bag = game.bagTiles as string[];

  const result = swapTiles(letters.map((l) => l.toUpperCase()), rack, bag);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }

  const nextPlayerIndex = game.currentPlayerIndex === 0 ? 1 : 0;

  await db.insert(gameMovesTable).values({
    id: generateId(),
    gameId,
    userId,
    moveType: "swap",
    tilesPlaced: null,
    wordsFormed: [],
    score: 0,
  });

  await db
    .update(gamePlayersTable)
    .set({ rack: result.newRack })
    .where(and(eq(gamePlayersTable.gameId, gameId), eq(gamePlayersTable.userId, userId)));

  const [updatedGame] = await db
    .update(gamesTable)
    .set({
      bagTiles: result.newBag,
      currentPlayerIndex: nextPlayerIndex,
      consecutivePasses: game.consecutivePasses + 1,
      turnDeadlineAt: makeTurnDeadline(),
      updatedAt: new Date(),
    })
    .where(eq(gamesTable.id, gameId))
    .returning();

  const updatedPlayers = await db.select().from(gamePlayersTable).where(eq(gamePlayersTable.gameId, gameId));
  const state = await buildGameState(updatedGame!, updatedPlayers, userId);
  emitGameStateUpdate(gameId, state);

  res.json({ success: true, gameState: state, wordsFormed: [], score: 0, message: "Tiles swapped — turn lost" });
});

router.post("/games/:gameId/pass", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { gameId } = req.params as { gameId: string };

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId)).limit(1);
  if (!game || game.status !== "active") {
    res.status(400).json({ error: "Game not active" });
    return;
  }

  const players = await db.select().from(gamePlayersTable).where(eq(gamePlayersTable.gameId, gameId));
  const currentPlayer = players.find((p) => p.playerIndex === game.currentPlayerIndex);
  if (currentPlayer?.userId !== userId) {
    res.status(400).json({ error: "Not your turn" });
    return;
  }

  const nextPlayerIndex = game.currentPlayerIndex === 0 ? 1 : 0;
  const newConsecutivePasses = game.consecutivePasses + 1;

  const racks = players.map((p) => p.rack as string[]);
  const bag = game.bagTiles as string[];
  const gameOver = isGameOver(bag, racks, newConsecutivePasses);

  let winnerId: string | null = null;
  if (gameOver) {
    const scores = players.map((p) => p.score);
    const maxScore = Math.max(...scores);
    winnerId = players[scores.indexOf(maxScore)]?.userId ?? null;
  }

  await db.insert(gameMovesTable).values({
    id: generateId(),
    gameId,
    userId,
    moveType: "pass",
    tilesPlaced: null,
    wordsFormed: [],
    score: 0,
  });

  const [updatedGame] = await db
    .update(gamesTable)
    .set({
      currentPlayerIndex: gameOver ? game.currentPlayerIndex : nextPlayerIndex,
      consecutivePasses: newConsecutivePasses,
      status: gameOver ? "finished" : "active",
      winnerId,
      turnDeadlineAt: gameOver ? null : makeTurnDeadline(),
      updatedAt: new Date(),
    })
    .where(eq(gamesTable.id, gameId))
    .returning();

  const updatedPlayers = await db.select().from(gamePlayersTable).where(eq(gamePlayersTable.gameId, gameId));
  const state = await buildGameState(updatedGame!, updatedPlayers, userId);
  emitGameStateUpdate(gameId, state);

  res.json({ success: true, gameState: state, wordsFormed: [], score: 0, message: gameOver ? "Game over!" : null });
});

router.post("/games/:gameId/resign", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { gameId } = req.params as { gameId: string };

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId)).limit(1);
  if (!game || game.status !== "active") {
    res.status(400).json({ error: "Game not active" });
    return;
  }

  const players = await db.select().from(gamePlayersTable).where(eq(gamePlayersTable.gameId, gameId));
  const isPlayer = players.some((p) => p.userId === userId);
  if (!isPlayer) {
    res.status(403).json({ error: "Not a player" });
    return;
  }

  const opponent = players.find((p) => p.userId !== userId);
  const winnerId = opponent?.userId ?? null;

  await db.insert(gameMovesTable).values({
    id: generateId(),
    gameId,
    userId,
    moveType: "resign",
    tilesPlaced: null,
    wordsFormed: [],
    score: 0,
  });

  const [updatedGame] = await db
    .update(gamesTable)
    .set({ status: "finished", winnerId, turnDeadlineAt: null, updatedAt: new Date() })
    .where(eq(gamesTable.id, gameId))
    .returning();

  const updatedPlayers = await db.select().from(gamePlayersTable).where(eq(gamePlayersTable.gameId, gameId));
  const state = await buildGameState(updatedGame!, updatedPlayers, userId);
  emitGameStateUpdate(gameId, state);

  res.json({ success: true, gameState: state, wordsFormed: [], score: 0, message: "You resigned" });
});

router.post("/games/:gameId/rematch", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { gameId } = req.params as { gameId: string };

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId)).limit(1);
  if (!game || game.status !== "finished") {
    res.status(400).json({ error: "Game not finished" });
    return;
  }

  const players = await db.select().from(gamePlayersTable).where(eq(gamePlayersTable.gameId, gameId));
  if (!players.some((p) => p.userId === userId)) {
    res.status(403).json({ error: "Not a player" });
    return;
  }

  // If a rematch already exists, return it instead of creating a duplicate
  if (game.rematchGameId) {
    const [existing] = await db.select().from(gamesTable).where(eq(gamesTable.id, game.rematchGameId)).limit(1);
    if (existing) {
      const existingPlayers = await db.select().from(gamePlayersTable).where(eq(gamePlayersTable.gameId, existing.id));
      const state = await buildGameState(existing, existingPlayers, userId);
      res.status(200).json(state);
      return;
    }
  }

  const opponent = players.find((p) => p.userId !== userId);
  if (!opponent) {
    res.status(400).json({ error: "Opponent not found" });
    return;
  }

  const bag = createBag();
  const emptyBoard = createEmptyBoard();
  const { newRack: rack0, newBag: bag1 } = fillRack([], bag);
  const { newRack: rack1, newBag: finalBag } = fillRack([], bag1);

  const firstPlayerIndex = Math.random() < 0.5 ? 0 : 1;
  const newGameId = generateId();

  const [newGame] = await db
    .insert(gamesTable)
    .values({
      id: newGameId,
      status: "active",
      boardState: emptyBoard,
      bagTiles: finalBag,
      currentPlayerIndex: firstPlayerIndex,
      consecutivePasses: 0,
      turnDeadlineAt: makeTurnDeadline(),
    })
    .returning();

  const newPlayers = firstPlayerIndex === 0
    ? [{ userId, rack: rack0, index: 0 }, { userId: opponent.userId, rack: rack1, index: 1 }]
    : [{ userId: opponent.userId, rack: rack0, index: 0 }, { userId, rack: rack1, index: 1 }];

  for (const p of newPlayers) {
    await db.insert(gamePlayersTable).values({
      id: generateId(),
      gameId: newGameId,
      userId: p.userId,
      rack: p.rack,
      score: 0,
      playerIndex: p.index,
    });
  }

  // Store rematchGameId on the original game to prevent duplicate rematches
  await db.update(gamesTable).set({ rematchGameId: newGameId }).where(eq(gamesTable.id, gameId));

  const gamePlayers = await db.select().from(gamePlayersTable).where(eq(gamePlayersTable.gameId, newGameId));
  const state = await buildGameState(newGame!, gamePlayers, userId);
  res.status(201).json(state);
});

router.get("/leaderboard", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;

  // Collect accepted friend IDs (friendship can be in either direction)
  const friendRows = await db
    .select({ requesterId: friendshipsTable.requesterId, addresseeId: friendshipsTable.addresseeId })
    .from(friendshipsTable)
    .where(
      and(
        eq(friendshipsTable.status, "accepted"),
        or(
          eq(friendshipsTable.requesterId, userId),
          eq(friendshipsTable.addresseeId, userId)
        )
      )
    );

  const friendIds = friendRows.map((f) =>
    f.requesterId === userId ? f.addresseeId : f.requesterId
  );
  // Always include the current user so they always appear on their own leaderboard
  const allowedIds = [userId, ...friendIds];

  const rows = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      wins: sql<number>`cast(count(case when ${gamesTable.winnerId} = ${usersTable.id} then 1 end) as int)`,
      gamesPlayed: sql<number>`cast(count(${gamesTable.id}) as int)`,
      totalScore: sql<number>`cast(coalesce(sum(${gamePlayersTable.score}), 0) as int)`,
    })
    .from(usersTable)
    .leftJoin(gamePlayersTable, eq(gamePlayersTable.userId, usersTable.id))
    .leftJoin(
      gamesTable,
      and(eq(gamesTable.id, gamePlayersTable.gameId), eq(gamesTable.status, "finished"))
    )
    .where(inArray(usersTable.id, allowedIds))
    .groupBy(usersTable.id, usersTable.username, usersTable.avatarUrl)
    .orderBy(
      desc(sql`count(case when ${gamesTable.winnerId} = ${usersTable.id} then 1 end)`),
      desc(sql`coalesce(sum(${gamePlayersTable.score}), 0)`)
    )
    .limit(25);

  const leaderboard = rows.map((row, i) => ({
    rank: i + 1,
    userId: row.id,
    username: row.username,
    avatarUrl: row.avatarUrl ?? null,
    wins: row.wins ?? 0,
    gamesPlayed: row.gamesPlayed ?? 0,
    winRate: row.gamesPlayed > 0 ? Math.round((row.wins / row.gamesPlayed) * 100) / 100 : 0,
    averageScore:
      row.gamesPlayed > 0 ? Math.round((row.totalScore / row.gamesPlayed) * 10) / 10 : 0,
  }));

  res.json(leaderboard);
});

router.get("/games/:gameId/hint", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { gameId } = req.params as { gameId: string };

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId)).limit(1);
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  const [myPlayer] = await db
    .select()
    .from(gamePlayersTable)
    .where(and(eq(gamePlayersTable.gameId, gameId), eq(gamePlayersTable.userId, userId)))
    .limit(1);

  if (!myPlayer) {
    res.status(403).json({ error: "Not a player" });
    return;
  }

  const board = game.boardState as BoardCell[][];
  const rack = myPlayer.rack as string[];
  const hint = findBestWord(board, rack);

  res.json(hint);
});

router.post("/games/:gameId/word-strength", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { gameId } = req.params as { gameId: string };
  const { tiles } = req.body as { tiles?: PlacedTile[] };

  if (!tiles || tiles.length === 0) {
    res.status(400).json({ error: "tiles required" });
    return;
  }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId)).limit(1);
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  const [myPlayer] = await db
    .select()
    .from(gamePlayersTable)
    .where(and(eq(gamePlayersTable.gameId, gameId), eq(gamePlayersTable.userId, userId)))
    .limit(1);

  if (!myPlayer) {
    res.status(403).json({ error: "Not a player" });
    return;
  }

  const board = game.boardState as BoardCell[][];
  const isFirstMove = board.every((row) => row.every((c) => c.letter === null));
  const validation = validateMove(board, tiles, isFirstMove);

  if (!validation.valid) {
    res.json({ valid: false, score: 0, strength: "weak", words: [] });
    return;
  }

  const words = findWordsFormed(board, tiles);
  const { valid } = validateWords(words);

  if (!valid) {
    res.json({ valid: false, score: 0, strength: "weak", words });
    return;
  }

  const score = calculateScore(board, tiles);
  const strength = getWordStrength(score);
  res.json({ valid: true, score, strength, words });
});

router.get("/games/:gameId/moves", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { gameId } = req.params as { gameId: string };

  const players = await db.select().from(gamePlayersTable).where(eq(gamePlayersTable.gameId, gameId));
  if (!players.some((p) => p.userId === userId)) {
    res.status(403).json({ error: "Not a player" });
    return;
  }

  const moves = await db
    .select()
    .from(gameMovesTable)
    .where(eq(gameMovesTable.gameId, gameId));

  const userMap = new Map<string, string>();
  for (const move of moves) {
    if (!userMap.has(move.userId)) {
      const [u] = await db
        .select({ username: usersTable.username })
        .from(usersTable)
        .where(eq(usersTable.id, move.userId))
        .limit(1);
      userMap.set(move.userId, u?.username ?? "");
    }
  }

  res.json(
    moves.map((m) => ({
      id: m.id,
      userId: m.userId,
      username: userMap.get(m.userId) ?? "",
      moveType: m.moveType,
      tilesPlaced: m.tilesPlaced,
      wordsFormed: m.wordsFormed ?? [],
      score: m.score,
      createdAt: m.createdAt.toISOString(),
    }))
  );
});

export default router;
