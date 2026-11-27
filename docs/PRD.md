# Connect 4 Take-Home PRD

Nov 26, 2026 * @Aryan

## Overview

Build a polished, server-authoritative Connect 4 that two players can play in one browser, with games saved to Postgres so a refresh never loses a game. Everything runs on local Kubernetes with one command, in about 4 hours.

**Goal:** a small game that feels finished, backed by a clean, tested codebase, rather than a big game that is half-built.

**Success criteria**

- A new player can start, play and finish a game with no instructions.
- Illegal moves are impossible: the server rejects them, not just the UI.
- Refreshing the page or reopening the game link resumes the same game.
- `make up` on a clean machine (with Docker, kind and kubectl installed) brings the whole stack up.
- The win-detection logic has unit tests covering every direction and edge case.

**S****tack:** Java 21 + Spring Boot backend, React + TypeScript (Vite) frontend, PostgreSQL, Docker, Kubernetes via kind.

## Scope

Build the must-haves first. Only start a stretch item when everything above it works and is committed.

| Priority | Feature | Why |
| --- | --- | --- |
| Must | Local two-player game (same screen) | The core loop; everything else depends on it |
| Must | Server-side move validation and win/draw detection | The rules can't be bypassed, and the logic stays testable |
| Must | Games saved in Postgres, resumable via URL | Gives the database a real job; refreshing never loses a game |
| Must | Turn indicator, winning-line highlight, draw state, rematch | Makes the game feel finished |
| Must | One-command local run on Kubernetes | Explicitly requested |
| Stretch 1 | Drop animation and hover preview of the landing spot | Highest polish payoff for the time |
| Stretch 2 | Online play from two browsers via a shareable link (polling) | Uses the backend you already have |
| Stretch 3 | Simple computer opponent (block or win in one, else random) | Solo play |

**Out of scope (goes in "what I'd do next"):** accounts and login, ratings or Elo, WebSockets, chat, game history and replays, a strong AI, production deployment, Helm charts.

## Game rules and edge cases

Standard Connect 4: a 7-column × 6-row board, and Red always moves first. A move is a column choice; the piece falls to the lowest empty row.

- **Win:** four in a row horizontally, vertically or on either diagonal. The game ends right away and the server returns the four winning cells.
- **Draw:** all 42 cells are filled and nobody has won.
- **Rejected moves (server returns an error, state unchanged):**
  - column outside 0–6
  - full column
  - game already finished
  - wrong player's turn (matters once online play exists)
  - stale move: the client's move number doesn't match the server's, for example after a double-click or in a second tab
- **Rematch:** creates a new game; the finished game stays saved.

The win check only needs to look at lines through the last piece placed, which keeps it simple and fast.

## UX requirements

The player should always know whose turn it is, where the piece will land and why the game ended.

**Screens:** a home screen with a "New game" button, then the game screen at `/game/:id`. Keep it to those two.

**Game screen**

- The board is the focus: centred, large, with clearly different Red and Yellow pieces.
- A turn indicator shows the current player's colour.
- Hovering over a column shows a ghost piece where the move would land. A full column shows as disabled.
- After a move, disable input until the server responds, so a double-click can't send two moves.
- When the game ends, a banner shows the result ("Red wins" or "Draw"), the winning four are highlighted, and a "Play again" button appears.
- A server error shows a short, friendly message, never a blank screen.

**Quality bar**

- Works on a phone-sized screen in portrait.
- Keyboard play: arrow keys pick a column, Enter drops the piece. The focus is visible.
- Colour isn't the only signal: the turn indicator and result banner also use words.
- Animation (stretch): the piece drops in about 300 ms; turn it off when the system's reduce-motion setting is on.

## Data model and API

There are two tables. `games` holds the current state, so loading a game is a single read. `moves` is an append-only log that gives you history for free and blocks duplicate moves.

**games**

| Column | Type | Notes |
| --- | --- | --- |
| id | UUID, primary key | Also used in the game URL |
| board | TEXT(42) | One character per cell (`.`, `R` or `Y`), stored row by row |
| current\_player | TEXT | `R` or `Y` |
| status | TEXT | `in_progress`, `red_won`, `yellow_won` or `draw` |
| winning\_cells | JSONB, nullable | e.g. `[[5,0],[5,1],[5,2],[5,3]]` |
| move\_count | INT | Doubles as the optimistic-lock version |
| created\_at, updated\_at | TIMESTAMPTZ |  |

**moves:** `game_id` (foreign key), `move_number`, `player`, `col`, `created_at`. A unique constraint on (`game_id`, `move_number`) means two moves can never land on the same turn.

**Endpoints** (JSON; every endpoint returns the full game object)

| Method and path | Request body | Responses |
| --- | --- | --- |
| `POST /api/games` | none | 201 with the new game |
| `GET /api/games/{id}` | none | 200, or 404 |
| `POST /api/games/{id}/moves` | `{"column": 3, "moveNumber": 7}` | 200 with the updated game; 400 for a bad column; 409 for a full column, a stale move number or a finished game; 404 |
| `GET /healthz` | none | 200; used by the Kubernetes health checks |

Errors use a single shape: `{"error": {"code": "COLUMN_FULL", "message": "That column is full."}}`. The frontend shows the message as is.

**Move handling:** in one transaction, lock the game row (`SELECT … FOR UPDATE`), check `moveNumber` against `move_count`, run the pure game logic, insert into `moves`, update `games`, then commit.

## Architecture

The backend is the single source of truth. The browser sends a column choice, and the backend validates it, saves it and returns the full new game state.

&#91;embedded content: architecture · 3 services in a kind cluster\]

Game rules live in a pure `game` package with no HTTP or database code, so they can be unit-tested on their own. The frontend never computes a winner; it only displays what the server returns.

## Infrastructure and run command

`make up` builds both images, creates a kind cluster, loads the images into it and applies plain Kubernetes manifests. The game is then at `http://localhost:8080`.

**Kubernetes resources (`k8s/`)**

- `postgres`: a StatefulSet with one replica, a PersistentVolumeClaim and a Service. Credentials come from a Secret; local-only values are fine.
- `backend`: a Deployment with 2 replicas (this shows the backend holds no state) and a Service. It reads `DATABASE_URL` from the Secret and has readiness and liveness checks on `/healthz`.
- `frontend`: a Deployment and a Service. nginx serves the built static files and forwards `/api` to the backend Service, so there are no cross-origin (CORS) issues.
- Access: a kind port mapping, or `kubectl port-forward` wrapped inside `make up`.

**Database migrations:** Flyway applies versioned SQL files when the backend starts, which Spring Boot supports out of the box. That's fine for this scope; a real project would use a separate migration job.

**Images:** multi-stage Dockerfiles. the backend is built with Maven and runs on a slim Eclipse Temurin JRE image, so no JDK is needed on the host; the frontend is built with Node and served by nginx.

**Dev loop:** `docker compose up` for fast iteration while building, plus `make down` and `make test`.

**Prerequisites** (listed in the README): Docker, kind and kubectl.

## Testing and conventions

Put most of the tests on the pure game logic, where bugs would hurt players most and tests are cheapest to write.

**Tests**

- **Game logic (must):** JUnit 5 parameterized tests. Cover a win in each direction (horizontal, vertical, both diagonals), wins at the board edges, a draw on a full board, a full column, an out-of-range column, a move after the game is over, and turn alternation.
- **API (should):** a few MockMvc controller tests for the main path and for the 409 cases (stale move number, full column).
- **Frontend (nice to have):** one component test that clicking a column sends the right move. Skip it if time is short.

**Repository layout**

```
backend/   Maven project; packages game (pure logic), store (JDBC), api (controllers)
frontend/  src/components (Board, Cell, StatusBar), src/api.ts, src/hooks/useGame.ts
k8s/       postgres.yaml, backend.yaml, frontend.yaml, secret.yaml
docs/      PRD.md, DECISIONS.md
Makefile   up, down, test
```

**Conventions**

- `game` doesn't import Spring or anything about HTTP or the database. Controllers stay thin: decode the request, call the store and the game logic, encode the response.
- The board is shared by row and column index; row 0 is the top row.
- Small commits, each with a clear message, one logical step at a time.
- No dependency without a reason: Spring Boot (web, JDBC, Flyway) and the Postgres driver, with no JPA or Hibernate; React with no state-management library.

## Build phases and time budget

Work through six phases totalling about 4 hours, with the riskiest part (infrastructure) first. Commit at the end of each phase and note the actual time spent.

1. **Plan (20 min):** finish this PRD and CLAUDE.md. *Done when:* both are committed.
2. **Walking skeleton (60 min):** repo layout, Dockerfiles, Kubernetes manifests, a backend `/healthz` that pings Postgres, and a frontend that shows the API status. *Done when:* `make up` on a fresh cluster shows "API OK" in the browser.
3. **Game logic, storage and API (60 min):** `game` and its tests first, then the migration, the store and the three endpoints. *Done when:* `make test` passes and a full game can be played with curl.
4. **Frontend (60 min):** board, turn indicator, game-over banner with rematch, routing to `/game/:id`, error handling. *Done when:* a full game can be played in the browser and survives a refresh.
5. **Polish (25 min):** hover preview, drop animation, keyboard play, mobile layout, then trying to break it. *Done when:* nothing obvious breaks.
6. **Submission (15 min):** README (single command, screenshot or GIF), DECISIONS.md (trade-offs and what's next), the time breakdown and the transcripts.

**If a phase overruns by 15 minutes**, cut from Polish first, never from tests or the README. Only start a stretch feature if phase 5 finishes early.

## Decisions and next steps

- **Backend:** Java 21 + Spring Boot, chosen over Go and PHP.
- **Frontend:** React + TypeScript (Vite).
- **One-command run:** kind.
- **First stretch feature:** the drop animation and hover preview.

**"What I'd do next"** (for the submission note): real-time online play over WebSockets with matchmaking; accounts and game history with replays; a minimax computer opponent with difficulty levels; end-to-end tests with Playwright;
