# Scrabble GO Clone

A full-stack Scrabble GO-style mobile app with async 1v1 gameplay, real-time chat, friends, push notifications, and TWL dictionary validation.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/mobile run dev` — run the Expo mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **Mobile**: Expo 54, React Native, Expo Router (file-based nav)
- **API**: Express 5, Socket.IO (WebSocket real-time)
- **DB**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Push**: expo-server-sdk
- **API codegen**: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- **Build**: esbuild (CJS bundle)

## Where things live

```
artifacts/
  api-server/src/
    routes/           # auth, users, friends, games, chat, stats, notifications
    lib/
      scrabble/       # game engine: board, bag, dictionary, constants, validation
      notifications.ts  # Expo push notification helpers
      websocket.ts    # Socket.IO setup
  mobile/app/
    (auth)/           # login + register screens
    (tabs)/           # index (games list), friends, profile tabs
    game/[id]/        # game board + chat screens
  mobile/components/  # GameBoard, TileRack, TileComponent, WordStrengthMeter, Avatar, GameCard
  mobile/contexts/    # AuthContext (JWT + AsyncStorage)
  mobile/hooks/       # useColors, usePushNotifications
lib/
  db/                 # Drizzle schema: users, games, game_players, game_moves, friendships, chat
  api-spec/           # OpenAPI 3.1 spec (source of truth for all contracts)
  api-client-react/   # Generated: React Query hooks
  api-zod/            # Generated: Zod schemas
```

## Architecture decisions

- **Contract-first API**: OpenAPI spec → Orval codegen → typed hooks + validators. Never hand-write fetch calls.
- **JWT auth**: stateless tokens; `setAuthTokenGetter` in api-client configures all generated hooks automatically.
- **Game state on server**: the board, bag, and racks live entirely in Postgres. The mobile client only gets `myRack` (never opponent's rack). `isCurrentTurn` is a boolean per player derived from `currentPlayerIndex`.
- **WebSocket for live updates**: Socket.IO room per game. `game_updated` event triggers a React Query invalidation, not a full state push — keeps the WS layer thin.
- **Push notifications**: device token stored on user row; sent by the server when turn changes. Non-critical — app degrades gracefully if push fails.

## Product

- **Login / Register** — JWT-based auth, persisted in AsyncStorage
- **Games tab** — active/finished game cards, pull-to-refresh, FAB → friends to start new game
- **Friends tab** — search users, send/accept/decline friend requests, share invite codes, challenge friends
- **Profile tab** — win/loss stats, notification toggles, avatar upload, sign out
- **Game board** — 15×15 Scrabble board, tap-to-place tiles, blank tile picker, submit/recall
- **Word strength meter** — live strength rating as tiles are placed
- **Best word hint** — server-computed best placement from current rack
- **Swap tiles** — select tiles from rack, swap with bag
- **In-game chat** — real-time via WebSocket with iMessage-style bubbles
- **Game over** — final score overlay, rematch button

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `useGetBestWordHint` and other query hooks in TQ v5 require `queryKey` when passing options — always include it: `{ query: { enabled: false, queryKey: [...] } }`
- Dynamic route navigation in Expo Router must use the pathname+params form: `router.push({ pathname: "/game/[id]", params: { id } } as any)` — template literals fail TypeScript
- Navigating back to the tabs root: use `router.replace("/(tabs)" as any)` — **not** `"/(tabs)/index"` which Expo Router does not recognise and shows "this screen doesn't exist".
- `FriendEntry` nests user data under `.user` (not at root). `GamePlayerState` has fields at root (no nesting).
- `ChatMessageInput` body field is `message` (not `content`). `ChatMessage` uses `userId` (not `senderId`).
- `useCreateInviteLink` mutation takes `void` — call `mutateAsync()` with no arguments.
- The game screen and chat screen must live in `app/game/[id]/` (exact brackets) — a stale `\[id\]` directory with literal backslashes was present and shadowing them; it has been removed.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- DB schema: `lib/db/src/schema.ts`
