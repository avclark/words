import { Router } from "express";
import { db } from "@workspace/db";
import { friendshipsTable, inviteLinksTable, usersTable } from "@workspace/db";
import { and, eq, or } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../middlewares/authenticate";
import { generateId } from "../lib/auth";

const router = Router();

const INVITE_EXPIRY_HOURS = 48;

router.get("/friends", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;

  const friendships = await db
    .select()
    .from(friendshipsTable)
    .where(
      or(
        eq(friendshipsTable.requesterId, userId),
        eq(friendshipsTable.addresseeId, userId)
      )
    );

  const userIds = new Set<string>();
  for (const f of friendships) {
    userIds.add(f.requesterId === userId ? f.addresseeId : f.requesterId);
  }

  const usersMap = new Map<string, { id: string; username: string; avatarUrl: string | null }>();
  if (userIds.size > 0) {
    const users = await db
      .select({ id: usersTable.id, username: usersTable.username, avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
      .where(eq(usersTable.id, [...userIds][0]!));

    // Fetch all needed users
    for (const uid of userIds) {
      const [u] = await db
        .select({ id: usersTable.id, username: usersTable.username, avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(eq(usersTable.id, uid))
        .limit(1);
      if (u) usersMap.set(uid, u);
    }
    void users;
  }

  const mapFriendEntry = (f: typeof friendshipsTable.$inferSelect) => {
    const otherUserId = f.requesterId === userId ? f.addresseeId : f.requesterId;
    const user = usersMap.get(otherUserId);
    if (!user) return null;
    return {
      friendshipId: f.id,
      user: { id: user.id, username: user.username, avatarUrl: user.avatarUrl },
      status: f.status as "accepted" | "pending",
      createdAt: f.createdAt,
    };
  };

  const friends = friendships
    .filter((f) => f.status === "accepted")
    .map(mapFriendEntry)
    .filter(Boolean);

  const pendingReceived = friendships
    .filter((f) => f.status === "pending" && f.addresseeId === userId)
    .map(mapFriendEntry)
    .filter(Boolean);

  const pendingSent = friendships
    .filter((f) => f.status === "pending" && f.requesterId === userId)
    .map(mapFriendEntry)
    .filter(Boolean);

  res.json({ friends, pendingReceived, pendingSent });
});

router.post("/friends/request", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { addresseeId } = req.body as { addresseeId?: string };

  if (!addresseeId) {
    res.status(400).json({ error: "Missing addresseeId" });
    return;
  }
  if (addresseeId === userId) {
    res.status(400).json({ error: "Cannot add yourself" });
    return;
  }

  // Check target user exists
  const [target] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, addresseeId))
    .limit(1);

  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Check existing friendship
  const existing = await db
    .select()
    .from(friendshipsTable)
    .where(
      or(
        and(eq(friendshipsTable.requesterId, userId), eq(friendshipsTable.addresseeId, addresseeId)),
        and(eq(friendshipsTable.requesterId, addresseeId), eq(friendshipsTable.addresseeId, userId))
      )
    )
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Friendship already exists" });
    return;
  }

  const [friendship] = await db
    .insert(friendshipsTable)
    .values({
      id: generateId(),
      requesterId: userId,
      addresseeId,
      status: "pending",
    })
    .returning();

  res.status(201).json(friendship);
});

router.patch("/friends/:friendshipId", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { friendshipId } = req.params as { friendshipId: string };
  const { action } = req.body as { action?: "accept" | "decline" };

  if (!action || !["accept", "decline"].includes(action)) {
    res.status(400).json({ error: "action must be accept or decline" });
    return;
  }

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(eq(friendshipsTable.id, friendshipId))
    .limit(1);

  if (!friendship) {
    res.status(404).json({ error: "Friendship not found" });
    return;
  }
  if (friendship.addresseeId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (friendship.status !== "pending") {
    res.status(400).json({ error: "Request already responded to" });
    return;
  }

  const [updated] = await db
    .update(friendshipsTable)
    .set({ status: action === "accept" ? "accepted" : "declined", updatedAt: new Date() })
    .where(eq(friendshipsTable.id, friendshipId))
    .returning();

  res.json(updated);
});

router.delete("/friends/:friendshipId", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { friendshipId } = req.params as { friendshipId: string };

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(eq(friendshipsTable.id, friendshipId))
    .limit(1);

  if (!friendship) {
    res.status(404).json({ error: "Friendship not found" });
    return;
  }
  if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(friendshipsTable).where(eq(friendshipsTable.id, friendshipId));
  res.json({ success: true });
});

router.post("/friends/invite-link", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + INVITE_EXPIRY_HOURS);

  const [link] = await db
    .insert(inviteLinksTable)
    .values({
      id: generateId(),
      createdBy: userId,
      expiresAt,
    })
    .returning();

  res.status(201).json({ token: link!.id, expiresAt: link!.expiresAt });
});

router.get("/friends/invite/:token", authenticate, async (req, res) => {
  const { token } = req.params as { token: string };

  const [link] = await db
    .select()
    .from(inviteLinksTable)
    .where(eq(inviteLinksTable.id, token))
    .limit(1);

  if (!link || link.expiresAt < new Date()) {
    res.status(404).json({ error: "Invalid or expired invite link" });
    return;
  }

  const [creator] = await db
    .select({ id: usersTable.id, username: usersTable.username, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.id, link.createdBy))
    .limit(1);

  if (!creator) {
    res.status(404).json({ error: "Creator not found" });
    return;
  }

  res.json({
    token: link.id,
    createdBy: { id: creator.id, username: creator.username, avatarUrl: creator.avatarUrl },
    expiresAt: link.expiresAt,
  });
});

router.post("/friends/invite/:token", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { token } = req.params as { token: string };

  const [link] = await db
    .select()
    .from(inviteLinksTable)
    .where(eq(inviteLinksTable.id, token))
    .limit(1);

  if (!link || link.expiresAt < new Date()) {
    res.status(404).json({ error: "Invalid or expired invite link" });
    return;
  }

  if (link.createdBy === userId) {
    res.status(400).json({ error: "Cannot accept your own invite" });
    return;
  }

  // Check for existing friendship
  const existing = await db
    .select()
    .from(friendshipsTable)
    .where(
      or(
        and(eq(friendshipsTable.requesterId, userId), eq(friendshipsTable.addresseeId, link.createdBy)),
        and(eq(friendshipsTable.requesterId, link.createdBy), eq(friendshipsTable.addresseeId, userId))
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Accept if pending
    if (existing[0]!.status === "pending") {
      const [updated] = await db
        .update(friendshipsTable)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(friendshipsTable.id, existing[0]!.id))
        .returning();
      res.json(updated);
      return;
    }
    res.status(409).json({ error: "Already friends" });
    return;
  }

  // Send friend request
  const [friendship] = await db
    .insert(friendshipsTable)
    .values({
      id: generateId(),
      requesterId: userId,
      addresseeId: link.createdBy,
      status: "pending",
    })
    .returning();

  res.json(friendship);
});

export default router;
