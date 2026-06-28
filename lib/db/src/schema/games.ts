import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./users";

export const gamesTable = pgTable("games", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("waiting"), // waiting | active | finished
  boardState: jsonb("board_state").notNull(), // 15x15 array of cells
  bagTiles: jsonb("bag_tiles").notNull(), // remaining tiles in bag
  currentPlayerIndex: integer("current_player_index").notNull().default(0),
  consecutivePasses: integer("consecutive_passes").notNull().default(0),
  turnDeadlineAt: timestamp("turn_deadline_at", { withTimezone: true }),
  winnerId: text("winner_id").references(() => usersTable.id),
  rematchGameId: text("rematch_game_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gamePlayersTable = pgTable("game_players", {
  id: text("id").primaryKey(),
  gameId: text("game_id")
    .notNull()
    .references(() => gamesTable.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  rack: jsonb("rack").notNull(), // array of letter strings
  score: integer("score").notNull().default(0),
  playerIndex: integer("player_index").notNull(), // 0 or 1
});

export const gameMovesTable = pgTable("game_moves", {
  id: text("id").primaryKey(),
  gameId: text("game_id")
    .notNull()
    .references(() => gamesTable.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  moveType: text("move_type").notNull(), // place | swap | pass | resign
  tilesPlaced: jsonb("tiles_placed"), // array of PlacedTile objects
  wordsFormed: text("words_formed").array(),
  score: integer("score").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGameSchema = createInsertSchema(gamesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof gamesTable.$inferSelect;

export const insertGamePlayerSchema = createInsertSchema(gamePlayersTable);
export type InsertGamePlayer = z.infer<typeof insertGamePlayerSchema>;
export type GamePlayer = typeof gamePlayersTable.$inferSelect;

export const insertGameMoveSchema = createInsertSchema(gameMovesTable).omit({
  createdAt: true,
});
export type InsertGameMove = z.infer<typeof insertGameMoveSchema>;
export type GameMove = typeof gameMovesTable.$inferSelect;
