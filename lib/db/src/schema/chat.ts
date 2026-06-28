import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { gamesTable } from "./games";
import { usersTable } from "./users";

export const gameChatTable = pgTable("game_chat", {
  id: text("id").primaryKey(),
  gameId: text("game_id")
    .notNull()
    .references(() => gamesTable.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGameChatSchema = createInsertSchema(gameChatTable).omit({
  createdAt: true,
});
export type InsertGameChat = z.infer<typeof insertGameChatSchema>;
export type GameChat = typeof gameChatTable.$inferSelect;
