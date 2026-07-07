# Product Requirements Document
## Scrabble GO Clone — Mobile Word Game

**Version:** 1.0  
**Date:** July 1, 2026  
**Status:** Built & In Testing

---

## 1. Overview

### 1.1 Product Vision
A mobile-first, asynchronous 1v1 Scrabble game that captures the look and feel of Scrabble GO — dark navy / gold / cream aesthetic, smooth tile interactions, real-time chat, and social features — built as a native iOS/Android app using Expo and a dedicated cloud API.

### 1.2 Goals
- Deliver a fully playable, rules-compliant Scrabble experience on mobile
- Support asynchronous play so users can take turns on their own schedule
- Build a social layer (friends, invites, leaderboard) that drives retention
- Provide power features (word hints, word strength meter, swap tiles) that educate and delight players

### 1.3 Non-Goals (v1)
- Tournament / ranked modes
- More than 2 players per game
- Web browser client
- AI/bot opponents
- In-app purchases or monetisation

---

## 2. Users & Use Cases

### 2.1 Target Users
| Persona | Description |
|---|---|
| **Casual player** | Plays a few games a week against friends; values ease of starting a game and a clean UI |
| **Word-game enthusiast** | Plays daily, wants hints and strength feedback to improve; cares about accurate dictionary and scoring |
| **Social gamer** | Primarily plays with people they know; uses friend search, invite links, and in-game chat |

### 2.2 Core Use Cases
1. Register / log in to an account
2. Find a friend and challenge them to a game
3. Play an async Scrabble game turn-by-turn (place tiles, submit a word)
4. Chat with opponent during a game
5. Use hints and word-strength feedback to make better moves
6. Track personal win/loss stats and compare with others on the leaderboard
7. Receive push notifications when it is their turn

---

## 3. Functional Requirements

### 3.1 Authentication

| ID | Requirement |
|---|---|
| AUTH-1 | Users can register with a username, email address, and password |
| AUTH-2 | Users can log in with email and password and receive a JWT |
| AUTH-3 | JWT is persisted in AsyncStorage and automatically attached to every API call |
| AUTH-4 | Users can sign out, which clears the token and returns them to the login screen |
| AUTH-5 | Passwords are hashed with bcrypt; tokens are signed with a server-side secret |

### 3.2 Games List (Home Tab)

| ID | Requirement |
|---|---|
| GAMES-1 | The home tab shows two sections: **Your Turn** and **Their Turn / Finished** |
| GAMES-2 | Each game card shows: both players' avatars, both scores, the board state thumbnail, and whose turn it is |
| GAMES-3 | Tapping a game card navigates to the game board |
| GAMES-4 | Pull-to-refresh reloads the list; the list also auto-refreshes every 30 seconds |
| GAMES-5 | A floating action button (FAB) opens the friends list to challenge someone and start a new game |
| GAMES-6 | Finished game cards show the winner and the final scores |

### 3.3 Game Board

| ID | Requirement |
|---|---|
| BOARD-1 | The board is a 15×15 grid with standard Scrabble premium squares (DLS, TLS, DWS, TWS, centre star) rendered in the correct positions and colours |
| BOARD-2 | Committed tiles (from previous turns) are shown on the board and cannot be moved |
| BOARD-3 | The player's rack shows up to 7 tiles at the bottom of the screen |
| BOARD-4 | **Tap-to-place:** tapping a rack tile selects it (highlighted border); tapping an empty board cell places the selected tile there |
| BOARD-5 | **Drag-to-place:** pressing and dragging a rack tile lifts it as a floating tile that follows the finger; releasing over a valid empty cell places it there |
| BOARD-6 | Tapping a tile that is already on the board (pending, not yet submitted) removes it and returns it to the rack |
| BOARD-7 | A **Recall** button returns all pending (unsubmitted) tiles to the rack |
| BOARD-8 | A **Submit** button validates and submits the current tile placement; disabled when no tiles are pending |
| BOARD-9 | On submission the server validates the word(s) against the TWL dictionary, checks connectivity, and returns the score delta; invalid moves show an error toast |
| BOARD-10 | After a successful move the board refreshes and turn passes to the opponent |
| BOARD-11 | A **Pass** option skips the player's turn without placing any tiles |
| BOARD-12 | A **Resign** option concedes the game immediately |
| BOARD-13 | Blank tiles (`?`) trigger a letter-picker modal when placed |
| BOARD-14 | The board scrolls/zooms if needed to fit the screen; the layout is measured and centered correctly accounting for the safe-area inset |

### 3.4 Word Strength Meter

| ID | Requirement |
|---|---|
| WSM-1 | While tiles are pending on the board (before submission) a meter below the board shows the projected point value of the move |
| WSM-2 | Strength levels: **Weak** (<10 pts), **Fair** (10–19), **Good** (20–29), **Great** (30–49), **Exceptional** (50+) |
| WSM-3 | The meter updates live as each tile is placed or removed |
| WSM-4 | The meter is hidden when the hint overlay is active |

### 3.5 Best Word Hint

| ID | Requirement |
|---|---|
| HINT-1 | A **Hint** option (in the overflow menu) triggers a server-side solver that finds the highest-scoring valid placement from the player's current rack |
| HINT-2 | The hint tiles are shown on the board as an overlay (distinct colour), not committed |
| HINT-3 | The player can submit the hinted word directly or recall it to dismiss |
| HINT-4 | Placing any tile manually while the hint is shown dismisses the hint |
| HINT-5 | The hint recomputes fresh each time it is requested (not cached across recalls) |

### 3.6 Swap Tiles

| ID | Requirement |
|---|---|
| SWAP-1 | A **Swap** option lets the player select one or more tiles from their rack to exchange with the bag |
| SWAP-2 | Swapping ends the player's turn (counts as passing) |
| SWAP-3 | Swap is disabled if the bag has fewer than 7 tiles remaining |

### 3.7 In-Game Chat

| ID | Requirement |
|---|---|
| CHAT-1 | A chat icon in the game header navigates to a full-screen chat view for the current game |
| CHAT-2 | Messages are displayed in iMessage-style bubbles: current user's messages on the right (gold), opponent's on the left (navy) |
| CHAT-3 | New messages are delivered in real time via WebSocket (Socket.IO) without requiring a manual refresh |
| CHAT-4 | Users can send emoji reactions from a quick-access emoji panel in the game board view |
| CHAT-5 | Chat history is persisted on the server and loaded on screen open |
| CHAT-6 | The message input field and send button sit above the keyboard and respect the safe-area inset |

### 3.8 Game Over

| ID | Requirement |
|---|---|
| OVER-1 | When the game ends (bag empty + one player plays out, or both players pass consecutively, or a player resigns) a game-over overlay is shown |
| OVER-2 | The overlay shows both players' final scores, remaining rack penalties subtracted, and the winner |
| OVER-3 | A **Rematch** button creates a new game between the same two players and navigates to it |
| OVER-4 | A **Back to lobby** button returns the user to the games list |

### 3.9 Friends

| ID | Requirement |
|---|---|
| FRIENDS-1 | The Friends tab lists: accepted friends, incoming requests, and outgoing requests |
| FRIENDS-2 | Users can search for other users by username |
| FRIENDS-3 | Users can send a friend request to any user found in search |
| FRIENDS-4 | Incoming friend requests can be accepted or declined |
| FRIENDS-5 | Existing friendships can be removed |
| FRIENDS-6 | Users can generate a shareable 8-character invite link; anyone who opens it is prompted to accept the friendship |
| FRIENDS-7 | Tapping **Challenge** next to a friend starts a new game against them |

### 3.10 Profile

| ID | Requirement |
|---|---|
| PROFILE-1 | The profile tab shows the user's username, avatar, and personal statistics |
| PROFILE-2 | Stats shown: games played, wins, losses, win rate, average score per game |
| PROFILE-3 | Users can upload or change their avatar image |
| PROFILE-4 | Users can toggle push notifications on/off |
| PROFILE-5 | Sign-out clears the session and returns to the login screen |

### 3.11 Leaderboard

| ID | Requirement |
|---|---|
| LB-1 | A Leaderboard tab shows global rankings ordered by win count |
| LB-2 | The top 3 players are highlighted with gold/silver/bronze medals |
| LB-3 | The current user's own rank is always visible, even if outside the top list |

### 3.12 Push Notifications

| ID | Requirement |
|---|---|
| PUSH-1 | On first launch, the app requests permission for push notifications |
| PUSH-2 | If permission is granted, the Expo push token is registered with the server |
| PUSH-3 | The server sends a push notification to the opponent when their turn begins |
| PUSH-4 | Notification delivery is best-effort; the app degrades gracefully if push is unavailable (e.g. Expo Go sandbox) |
| PUSH-5 | Users can disable push notifications from the Profile tab |

---

## 4. Game Rules & Engine

### 4.1 Board
- Standard 15×15 Scrabble board
- Premium squares follow the official Scrabble layout:
  - **TWS** (Triple Word Score) — 8 squares at corners and edges
  - **DWS** (Double Word Score) — 16 squares including centre star
  - **TLS** (Triple Letter Score) — 12 squares
  - **DLS** (Double Letter Score) — 24 squares

### 4.2 Tiles
- Standard English Scrabble tile distribution (100 tiles)
- Blank tiles (`?`) count as 0 points and can represent any letter
- Each player draws up to 7 tiles; tiles are refilled from the bag after each move

### 4.3 Valid Moves
- All placed tiles must be in a single row or column
- Tiles must form a connected word (no gaps)
- Every word formed (the main word and any cross-words created) must appear in the TWL (Tournament Word List) dictionary
- The first move of the game must cover the centre star square

### 4.4 Scoring
- Letter values follow standard Scrabble point values
- Premium squares apply only on the turn they are first covered
- All formed words are scored and summed
- **Bingo bonus:** +50 points for using all 7 rack tiles in one move
- **Game end:** each player's remaining rack tiles are summed and subtracted from their score; if a player played out, their rack total is added to their score instead

### 4.5 Dictionary
- TWL06 (Tournament Word List) — used for all word validation
- Validation is server-side only; the client shows the result (valid / invalid word list)

---

## 5. Non-Functional Requirements

### 5.1 Performance
- Game board screen must load within 2 seconds on a standard LTE connection
- Word strength meter must update within 500 ms of tile placement
- Hint computation must return within 3 seconds for any legal rack position

### 5.2 Reliability
- Game state lives exclusively on the server (board, bag, racks) — the client is stateless
- WebSocket disconnections are handled gracefully; the app falls back to polling on reconnect
- Push notification failures do not block gameplay

### 5.3 Security
- All API endpoints (except `/auth/register` and `/auth/login`) require a valid JWT
- Passwords stored as bcrypt hashes (cost factor ≥ 10)
- Each player can only see their own rack tiles; the opponent's rack is never sent over the wire

### 5.4 Compatibility
- iOS 16+ (primary target)
- Android 12+ (secondary target)
- Tested on physical device via Expo Go and production build

---

## 6. Architecture Summary

```
Mobile App (Expo / React Native)
  ↕  HTTPS + WebSocket
API Server (Express 5 / Socket.IO)
  ↕  SQL
PostgreSQL (Drizzle ORM)
```

| Layer | Technology |
|---|---|
| Mobile | Expo 54, React Native, Expo Router (file-based nav) |
| State management | React Query v5 (TanStack Query) |
| API contract | OpenAPI 3.1 spec → Orval codegen → typed hooks + Zod schemas |
| API server | Express 5, Socket.IO |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Database | PostgreSQL + Drizzle ORM |
| Push notifications | Expo Server SDK |
| Build | esbuild (CJS bundle for server), Metro (mobile) |

---

## 7. Data Model

### Users
`id`, `username`, `email`, `password_hash`, `avatar_url`, `push_token`, `notifications_enabled`, `created_at`

### Friendships
`id`, `requester_id → users`, `addressee_id → users`, `status` (pending | accepted), `invite_token`, `created_at`

### Games
`id`, `status` (waiting | active | finished), `board_state` (JSON 15×15), `bag_tiles` (JSON array), `current_player_index`, `winner_id → users`, `created_at`, `updated_at`

### GamePlayers
`id`, `game_id → games`, `user_id → users`, `player_index`, `rack` (JSON array), `score`

### GameMoves
`id`, `game_id → games`, `user_id → users`, `move_type` (place | swap | pass | resign), `tiles_placed` (JSON), `words_formed` (JSON), `score`, `created_at`

### GameChat
`id`, `game_id → games`, `user_id → users`, `message`, `created_at`

---

## 8. API Surface (Summary)

| Group | Endpoints |
|---|---|
| **Auth** | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| **Users** | `GET /users/search`, `PATCH /users/me`, `POST /users/me/avatar`, `POST /users/me/push-token`, `GET /users/:id` |
| **Friends** | `GET /friends`, `POST /friends/request`, `PATCH /friends/:id`, `DELETE /friends/:id`, `POST /friends/invite-link`, `GET|POST /friends/invite/:token` |
| **Games** | `GET /games`, `POST /games`, `GET /games/:id`, `POST /games/:id/move`, `POST /games/:id/swap`, `POST /games/:id/pass`, `POST /games/:id/resign`, `POST /games/:id/rematch`, `GET /games/:id/hint`, `POST /games/:id/word-strength`, `GET /games/:id/moves` |
| **Chat** | `GET /games/:id/chat`, `POST /games/:id/chat` |
| **Stats** | `GET /stats`, `GET /leaderboard` |

Real-time events over Socket.IO:
- `join_game` — subscribe to a game room
- `game_updated` — triggers React Query invalidation on both clients
- `new_chat_message` — delivers incoming chat messages instantly

---

## 9. Screen Map

```
(auth)
  ├── /login
  └── /register

(tabs)
  ├── / (Games list)
  ├── /friends
  ├── /leaderboard
  └── /profile

/game/[id]
  ├── /           (board + rack + actions)
  └── /chat       (full-screen chat)
```

---

## 10. UI Design Language

| Element | Value |
|---|---|
| Background | Dark navy `#0D1B2A` |
| Accent / tiles | Gold `#C9A84C` |
| Tile face | Cream `#F5F0E8` |
| Text primary | White / cream |
| Premium squares | DWS pink, TWS red, DLS light blue, TLS dark blue |
| Font | System default (SF Pro on iOS, Roboto on Android) |
| Corners | Rounded (8–16 px) throughout |
| Shadows | Subtle elevation on tiles and cards |

---

## 11. Known Limitations (v1)

| # | Limitation |
|---|---|
| 1 | Drag-and-drop tile placement is under active debugging on native iOS |
| 2 | Expo Go sandbox does not support push notification token registration |
| 3 | No spectator mode — only the two players can view a game |
| 4 | No time controls or turn timers |
| 5 | Rematch always creates a new game; ELO or ranked history is not tracked |
| 6 | Invite links expire only manually; no automatic expiry |

---

## 12. Future Roadmap (Post v1)

| Priority | Feature |
|---|---|
| High | Reliable drag-and-drop via react-native-gesture-handler |
| High | Game timer / turn clock option |
| Medium | AI opponent (bot) for solo play |
| Medium | ELO-based ranked matchmaking |
| Medium | Word definition lookup after each move |
| Medium | In-app notifications / notification centre |
| Low | Tournament brackets |
| Low | Custom tile and board themes |
| Low | Multi-language dictionary support |
