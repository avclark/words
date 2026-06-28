import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../middlewares/authenticate";

const router = Router();

router.get("/notifications/settings", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const [user] = await db
    .select({ notificationTurn: usersTable.notificationTurn, notificationChat: usersTable.notificationChat })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ notificationTurn: user.notificationTurn, notificationChat: user.notificationChat });
});

router.patch("/notifications/settings", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { notificationTurn, notificationChat } = req.body as {
    notificationTurn?: boolean;
    notificationChat?: boolean;
  };

  const updates: Partial<typeof usersTable.$inferSelect> = { updatedAt: new Date() };
  if (notificationTurn !== undefined) updates.notificationTurn = notificationTurn;
  if (notificationChat !== undefined) updates.notificationChat = notificationChat;

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, userId))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ notificationTurn: user.notificationTurn, notificationChat: user.notificationChat });
});

export default router;
