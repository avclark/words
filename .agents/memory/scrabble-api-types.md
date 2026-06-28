---
name: Scrabble app API types
description: Correct property names for generated API types; design subagent made wrong assumptions
---

## FriendsList
- `pendingReceived` (NOT `pendingIncoming`)
- `pendingSent` (NOT `pendingOutgoing`)

## FriendEntry
- `{ friendshipId, user: UserPublic, status, createdAt }` — user data lives under `.user`, not at root

## FriendRequest body
- `{ addresseeId }` (NOT `userId`)

## respondFriendRequest params
- `{ friendshipId, data: { action } }` (NOT `requestId`)

## InviteLink
- `{ token, expiresAt }` (NOT `url`)
- `createInviteLink` mutation takes `void` — call `mutateAsync()` with no args

## GameSummary
- Has `isMyTurn: boolean` (NOT `currentTurnPlayerId`)

## PlayerStats
- `averageScore` (NOT `avgScore`)

## NotificationSettings
- `notificationTurn`, `notificationChat` (NOT `turnNotifications`/`chatNotifications`)

## SearchUsersParams
- `{ q: string }` (NOT `username`)

## useCheckWordStrength
- Is a **mutation** (POST), not a query — signature: `useCheckWordStrength(options?)`, mutate with `{ gameId, data: { tiles } }`
- Use `useEffect` + `mutate` pattern for reactive tile placement updates

## TanStack Query v5 + Orval
- Generated hooks use `UseQueryOptions` which requires `queryKey` in TQ v5
- When passing `enabled` override, must also include `queryKey` in the query options object

**Why:** orval code-generated types mirror OpenAPI spec exactly; design subagents often guess property names from common conventions that differ from the actual spec.
