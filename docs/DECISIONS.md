# Decisions and trade-offs

Trade-offs and next steps are completed in Phase 6.

## Known limitations

Found while trying to break the app in Phase 5, and left as they are.

- **Very small sideways screens:** at 568 × 320, the bottom 12 px of the board needs scrolling. The PRD requires portrait, and the larger sideways sizes tested (667 × 375 and 844 × 390) fit. Fixing it would make the columns narrower.
- **Requests rejected before reaching the app:** an ID with an encoded slash or broken encoding, or a very long header, gets a web server's own HTML page, not the JSON error shape. A 20,000-character game address shows nginx's "414 Request-URI Too Large" page. The app's own links don't produce these.
- **Request size:** nginx rejects bodies over its default 1 MB limit with its own 413 page. The backend sets no limit of its own and read a 2 MB request sent to it directly, but in the cluster browsers can only reach it through nginx.
- **Repeated JSON fields:** if a move request repeats a field, the last value is used. The move is still fully checked.
- **One frontend and one database:** replacing the frontend pod interrupted requests for a few seconds (failures spread over about 15 s). Replacing or killing the database pod caused errors for about 20 s, mostly "Something went wrong" because the backends still counted as ready at first. The app recovered by itself, with "Try again" where needed. None of the 1,400 moves the server had confirmed during these tests was lost.
- **Killing both backends at once** caused a few 502 and 504 errors for about 5 s. Replacing one, or a rolling restart, caused no failed requests in the test.
- **Very heavy traffic:** nginx opens a new connection to the backend for every request. After about 28,800 requests in 60 s it ran out of its 28,232 ports and returned 502s until some were freed. That is about 480 requests a second, far beyond two players. Reusing connections would raise the limit, but would need the restart behaviour tested again.
