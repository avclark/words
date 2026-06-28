import { Router } from "express";
import { db } from "@workspace/db";
import { gameMovesTable, gamePlayersTable, gamesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../middlewares/authenticate";

const router = Router();

async function computeStats(targetUserId: string) {
  const [user] = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, targetUserId))
    .limit(1);

  if (!user) return null;

  const playerGames = await db
    .select()
    .from(gamePlayersTable)
    .where(eq(gamePlayersTable.userId, targetUserId));

  const finishedGames = await Promise.all(
    playerGames.map(async (pg) => {
      const [game] = await db
        .select()
        .from(gamesTable)
        .where(eq(gamesTable.id, pg.gameId))
        .limit(1);
      if (!game || game.status !== "finished") return null;
      return { game, playerEntry: pg };
    })
  );

  const finished = finishedGames.filter(Boolean) as Array<{
    game: typeof gamesTable.$inferSelect;
    playerEntry: typeof gamePlayersTable.$inferSelect;
  }>;

  const gamesPlayed = finished.length;
  const gamesWon = finished.filter((g) => g.game.winnerId === targetUserId).length;
  const gamesLost = gamesPlayed - gamesWon;
  const winRate = gamesPlayed > 0 ? gamesWon / gamesPlayed : 0;
  const scores = finished.map((g) => g.playerEntry.score);
  const totalPoints = scores.reduce((a, b) => a + b, 0);
  const averageScore = gamesPlayed > 0 ? totalPoints / gamesPlayed : 0;
  const bestScore = scores.length > 0 ? Math.max(...scores) : 0;

  // Find best word (highest single move score)
  const moves = await db
    .select()
    .from(gameMovesTable)
    .where(eq(gameMovesTable.userId, targetUserId));

  const placeMoves = moves.filter((m) => m.moveType === "place");
  const bestMove = placeMoves.reduce(
    (best, m) => (m.score > (best?.score ?? 0) ? m : best),
    null as typeof gameMovesTable.$inferSelect | null
  );

  const bestWord =
    bestMove && bestMove.wordsFormed && bestMove.wordsFormed.length > 0
      ? bestMove.wordsFormed[0]!
      : null;
  const bestWordScore = bestMove?.score ?? 0;

  return {
    userId: user.id,
    username: user.username,
    gamesPlayed,
    gamesWon,
    gamesLost,
    winRate: Math.round(winRate * 100) / 100,
    averageScore: Math.round(averageScore * 10) / 10,
    bestScore,
    bestWord,
    bestWordScore,
    totalPoints,
  };
}

router.get("/stats", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const stats = await computeStats(userId);
  if (!stats) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(stats);
});

router.get("/stats/:userId", authenticate, async (req, res) => {
  const { userId: targetId } = req.params as { userId: string };
  const stats = await computeStats(targetId);
  if (!stats) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(stats);
});

export default router;
