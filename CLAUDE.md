# CLAUDE.md

A server-authoritative Connect 4 take-home: two players in one browser, games saved in Postgres, run on local Kubernetes. The goal is a small game that feels finished, with a clean, tested codebase.

[docs/PRD.md](docs/PRD.md) is the source of truth for rules, UX, the API, infrastructure and tests. Read the relevant section before building. If the code needs to differ from it, raise that first.

## Stack

- `backend/`: Java 21, Spring Boot (web, JDBC, Flyway), PostgreSQL, Maven wrapper
- `frontend/`: React, TypeScript, Vite
- `k8s/`: plain manifests for kind, plus the cluster config `kind.yaml`

## Rules

- The repo must run on macOS, Linux and Windows (WSL2), and the app must work in phone browsers over the local network. That address is plain HTTP, so don't rely on browser APIs that need HTTPS, such as `crypto.randomUUID`.
- The server decides everything. The frontend may disable controls, such as a full column, but the server validates every move. The frontend never computes a winner; it displays what the server returns.
- The `game` package is pure: no Spring, HTTP or database imports. It copies the board before applying a move.
- Controllers stay thin. `store` holds the JDBC code.
- The board is `board[row][col]`, 6 rows by 7 columns, with row 0 at the top. The 42-character string exists only in storage.
- A move is one transaction that locks the game row. Request `moveCount` is the number of moves already made; `moves.move_number` starts at 1.
- Follow the PRD's error check order, codes and messages exactly.
- No new dependency without a reason. No JPA or Hibernate, no Testcontainers, no frontend state-management library, no Helm.

## Commands

Update this section if any command changes. The development database is on host port 5433, so a locally installed Postgres can keep 5432. On the host, `./mvnw test` needs that database running.

| Command | Purpose |
| --- | --- |
| `./scripts/setup.sh [--dev]` | Install the required tools on macOS or Ubuntu; `--dev` adds a JDK, Node and the frontend libraries. If a tool requirement changes, update the script and the PRD together |
| `docker compose up` | Start the development database only |
| `cd backend && ./mvnw spring-boot:run` | Run the backend on port 8081 |
| `cd frontend && npm run dev` | Run Vite at `http://localhost:5173` |
| `cd frontend && npm test` | Run the frontend tests (`npm run typecheck` checks types) |
| `make test` | Run backend tests against a temporary Postgres, then the frontend type check and tests, all in containers in a separate Compose project |
| `make up` | Recreate the kind cluster and serve the app on port 8080, to this computer and others on the same network. **Erases saved games** |
| `make down` | Delete the kind cluster. **Erases saved games** |

The host may have a newer JDK, so the build sets `maven.compiler.release` to 21.

## Testing

- Write the `game` tests first, using JUnit 5 parameterized tests. They run without Spring or a database.
- API tests use MockMvc with real Postgres, including the concurrent-move test.
- From Phase 2 on, run `make up` at the end of each phase. The dev setup doesn't use nginx.

## Workflow

- Follow the PRD's phases and priorities: Must, then Polish; Stretch only after submission work is done.
- Make small commits with clear messages, one logical step at a time, including one at the end of each phase.
- Note the actual time spent on each phase.
- Record trade-offs in `docs/DECISIONS.md`.
