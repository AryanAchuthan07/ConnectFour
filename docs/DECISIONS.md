# Decisions and trade-offs

The aim was a small game that looks and feels finished, with a clean, tested codebase, rather than a bigger one that's half built.

## Game and data

| Decision | Why | Trade-off |
| --- | --- | --- |
| The server decides every move | The rules can't be bypassed from the browser | Every move waits for the server, and a piece appears only once it's accepted |
| Rules in a plain Java `game` package | They can be tested without Spring or a database | The API and storage have to convert to and from its types |
| One transaction per move, locking the game row, with the client's move count | A double click or a second tab can't play twice. Without the lock, a test showed the second request failing with a duplicate-key error instead of "the game has changed" | Moves in one game happen one at a time, which suits a turn-based game. A unique constraint is the backup |
| Current state in `games`, plus a `moves` log | Loading a game is one read, and the log records its history | The two must be saved together, so they share a transaction |
| A 2D array in the API and rules, a 42-character string in the database | The array is easier to read. The string is a simple storage format | One conversion on each load and save. The array is also bigger to send, which doesn't matter at this size |
| All winning cells are returned | A line of five or more, or two lines at once, is highlighted in full | The list isn't always four cells |
| Spring Boot with JDBC, no JPA or Hibernate | Two tables and a few queries, with the row lock written out plainly | SQL and row mapping are written by hand |
| Java and Spring Boot, chosen over Go and PHP | Decided during planning | The backend takes more memory than a small Go service typically would |

## Frontend

| Decision | Why | Trade-off |
| --- | --- | --- |
| No routing or state-management library | There are two screens and one game's state | The small router is our own code |
| Reload the game after a failed move that may have changed it | A move can be saved even if the reply is lost. If reloading fails, moves stay locked until "Try again" works | An extra request after those failures |
| A piece appears only after the server accepts it | The screen never shows a move that wasn't saved | A slow connection delays the piece |
| Yellow has a centre ring, and results are written in words | Colour isn't the only signal | |
| The focus outline appears only after a key is used | It looked out of place when a game opened on a phone or computer | A keyboard player sees it only after the first key press |
| The rules use the browser's `<dialog>` | It handles blocking the page and Escape without a library | The test browser lacks `showModal`, so those were checked in Chrome |

## Running it

| Decision | Why | Trade-off |
| --- | --- | --- |
| kind with plain manifests | One command gives a local Kubernetes setup, with nothing else to learn such as Helm | Needs Docker, and isn't a production setup |
| `make up` always recreates the cluster | It matches a first run on a new computer | **It erases saved games.** Day-to-day work uses the development database |
| In development, only Postgres runs in Docker | Faster feedback with Java and Vite on the host | Developers need a JDK and Node, and nginx differences show up only in `make up` |
| Two backend replicas with no state of their own | Shows that any backend can serve any game | Uses more memory |
| Liveness checks `/livez`, readiness checks `/healthz` with the database | A database outage stops traffic without restarting healthy backends | A backend with stuck database connections loses traffic but isn't restarted |
| Backends wait 5 s before shutting down | Without it, 9 of 467 health checks failed with 504 across three restarts. With it, all 474 passed | Replacing a pod takes longer. It doesn't guarantee no request is ever dropped |
| Flyway migrates when the backend starts | Built into Spring Boot, and enough here | A real deployment would run migrations as a separate job |
| The app accepts connections from the local network | Phones and other computers can play | No accounts and plain HTTP, so only use it on a network you trust. The development database stays local |
| Local-only database credentials in a Secret file | Lets one command start everything | They aren't real secrets and must not be reused |

## Testing

- **Tests came before each part of the code from the game rules onward.** When a new test passed before its code was written, the related behaviour was usually broken on purpose to confirm the test could fail.
- **Database and API tests use a real Postgres,** with no mocked store and no Testcontainers. The simultaneous-move test holds the row lock until both requests are waiting, so they really do overlap.
- **Frontend tests fake only the network.** The simulated browser can't check layout, animation or real popup behaviour, so temporary scripts checked those in headless Chrome. **Those scripts aren't in the repo,** so these checks can't be rerun from it.

## Changes from the original plan

- Hover preview, keyboard play and the phone layout became required. The drop animation was left as polish, and was built.
- Frontend tests went from optional to required, which raised the minimum Node version for development.
- Added: a setup script, access from the local network, a Rules popup, a loading "Try again", and high-contrast and large-text fixes.
- No preview shows while a piece is falling.
- The stretch features, online play and a computer opponent, weren't built.

## What I'd do next

- Real-time online play over WebSockets, with matchmaking.
- Accounts, and game history with replays.
- A minimax computer opponent with difficulty levels.
- End-to-end tests with Playwright, replacing the temporary browser scripts.
- Run those and `make test` automatically on every push.
- Test on Windows with WSL2, on Intel hardware and on a Mac without the tools.
- For real deployment: HTTPS, access control, real secrets, separate migrations, and a database and frontend that aren't single copies.

## Known limitations

Found while trying to break the app, and left as they are.

- **Very small sideways screens:** at 568 × 320, the bottom 12 px of the board needs scrolling. The PRD requires portrait, and the larger sideways sizes tested (667 × 375 and 844 × 390) fit. Fixing it would make the columns narrower.
- **Requests rejected before reaching the app:** an ID with an encoded slash or broken encoding, or a very long header, gets a web server's own HTML page, not the JSON error shape. A 20,000-character game address shows nginx's "414 Request-URI Too Large" page. The app's own links don't produce these.
- **Request size:** nginx rejects bodies over its default 1 MB limit with its own 413 page. The backend sets no limit of its own and read a 2 MB request sent to it directly, but in the cluster browsers can only reach it through nginx.
- **Repeated JSON fields:** if a move request repeats a field, the last value is used. The move is still fully checked.
- **One frontend and one database:** replacing the frontend pod interrupted requests for a few seconds (failures spread over about 15 s). Replacing or killing the database pod caused errors for about 20 s, mostly "Something went wrong" because the backends still counted as ready at first. The app recovered by itself, with "Try again" where needed. None of the 1,400 moves the server had confirmed during these tests was lost.
- **Killing both backends at once** caused a few 502 and 504 errors for about 5 s. Replacing one, or a rolling restart, caused no failed requests in that test.
- **Very heavy traffic:** nginx opens a new connection to the backend for every request. After about 28,800 requests in 60 s it ran out of its 28,232 ports and returned 502s until some were freed. That's about 480 requests a second, far beyond two players. Reusing connections would raise the limit, but would need the restart behaviour tested again.
