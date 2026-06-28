import path from "path";
import fs from "fs";
import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, ilike, ne } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../middlewares/authenticate";
import { generateId } from "../lib/auth";

const router = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const uploadsDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads/avatars");
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images allowed"));
    }
  },
});

router.get("/users/search", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const q = req.query["q"] as string;

  if (!q || q.trim().length < 2) {
    res.status(400).json({ error: "Query must be at least 2 characters" });
    return;
  }

  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(usersTable)
    .where(ilike(usersTable.username, `%${q}%`))
    .limit(20);

  const filtered = users.filter((u) => u.id !== userId);
  res.json(filtered.map((u) => ({ id: u.id, username: u.username, avatarUrl: u.avatarUrl })));
});

router.patch("/users/me", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { username } = req.body as { username?: string };

  if (username !== undefined) {
    if (username.length < 3 || username.length > 20) {
      res.status(400).json({ error: "Username must be 3-20 characters" });
      return;
    }
    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);

    if (existing.length > 0 && existing[0]!.id !== userId) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }
  }

  const [user] = await db
    .update(usersTable)
    .set({ ...(username ? { username } : {}), updatedAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    notificationTurn: user.notificationTurn,
    notificationChat: user.notificationChat,
    createdAt: user.createdAt,
  });
});

router.post(
  "/users/me/avatar",
  authenticate,
  upload.single("avatar"),
  async (req, res) => {
    const { userId } = req as AuthRequest;
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const ext = req.file.mimetype.split("/")[1] ?? "jpg";
    const filename = `${generateId()}.${ext}`;
    const newPath = path.join(uploadsDir, filename);
    fs.renameSync(req.file.path, newPath);

    const avatarUrl = `/api/uploads/avatars/${filename}`;
    const [user] = await db
      .update(usersTable)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      notificationTurn: user.notificationTurn,
      notificationChat: user.notificationChat,
      createdAt: user.createdAt,
    });
  }
);

router.post("/users/me/push-token", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { token } = req.body as { token?: string };

  if (!token) {
    res.status(400).json({ error: "Missing push token" });
    return;
  }

  await db
    .update(usersTable)
    .set({ pushToken: token, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  res.json({ success: true });
});

router.get("/users/:userId", authenticate, async (req, res) => {
  const { userId: targetId } = req.params as { userId: string };

  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(usersTable)
    .where(eq(usersTable.id, targetId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ id: user.id, username: user.username, avatarUrl: user.avatarUrl });
});

// Serve uploaded avatars
router.use("/uploads/avatars", (req, res, next) => {
  const filename = path.basename(req.url);
  const filePath = path.join(uploadsDir, filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    next();
  }
});

export default router;
