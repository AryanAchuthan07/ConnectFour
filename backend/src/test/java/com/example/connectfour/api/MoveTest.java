package com.example.connectfour.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
class MoveTest {

    @Autowired
    private MockMvc mvc;

    // Reads the moves table directly: no endpoint exposes it.
    @Autowired
    private JdbcClient jdbc;

    // ---------- the main path ----------

    @Test
    void aMoveIsReturnedAndStillThereWhenReloaded() throws Exception {
        String id = newGame();

        String afterMove = move(id, 3, 0)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.board[5][3]").value("R"))
                .andExpect(jsonPath("$.currentPlayer").value("Y"))
                .andExpect(jsonPath("$.status").value("in_progress"))
                .andExpect(jsonPath("$.winningCells").value((Object) null))
                .andExpect(jsonPath("$.moveCount").value(1))
                .andReturn().getResponse().getContentAsString();

        assertEquals(afterMove, load(id));
        assertEquals(List.of("1 R 3"), recordedMoves(id));
    }

    @Test
    void aWholeGameCanBePlayedToAWin() throws Exception {
        String id = playToRedWin();

        mvc.perform(get("/api/games/{id}", id))
                .andExpect(jsonPath("$.status").value("red_won"))
                .andExpect(jsonPath("$.currentPlayer").value("R"))
                .andExpect(jsonPath("$.moveCount").value(7))
                .andExpect(content().json("{\"winningCells\": [[5,0],[5,1],[5,2],[5,3]]}", JsonCompareMode.LENIENT))
                .andExpect(jsonPath("$.winningCells.length()").value(4));
        assertEquals(
                List.of("1 R 0", "2 Y 0", "3 R 1", "4 Y 1", "5 R 2", "6 Y 2", "7 R 3"), recordedMoves(id));
    }

    @Test
    void sendingTheSameMoveTwiceOnlyPlaysItOnce() throws Exception {
        String id = newGame();
        move(id, 3, 0).andExpect(status().isOk());

        expectError(move(id, 3, 0), 409, "STALE_MOVE");

        assertEquals(List.of("1 R 3"), recordedMoves(id));
    }

    @Test
    void theBodyIsReadAsJsonWhateverItsContentTypeSays() throws Exception {
        // What `curl -d` sends without a header.
        mvc.perform(post("/api/games/{id}/moves", newGame())
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .content("{\"column\": 2, \"moveCount\": 0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.board[5][2]").value("R"));
        mvc.perform(post("/api/games/{id}/moves", newGame()).content("{\"column\": 2, \"moveCount\": 0}"))
                .andExpect(status().isOk());
    }

    @Test
    void extraFieldsAreIgnored() throws Exception {
        send(newGame(), "{\"column\": 1, \"moveCount\": 0, \"player\": \"Y\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.board[5][1]").value("R"));
    }

    // ---------- rejected moves leave everything as it was ----------

    @ParameterizedTest
    @ValueSource(strings = {
            "",
            "   ",
            "{",
            "not json",
            "[3, 0]",
            "3",
            "null",
            "{}",
            "{\"column\": 3}",
            "{\"moveCount\": 0}",
            "{\"column\": null, \"moveCount\": 0}",
            "{\"column\": 3, \"moveCount\": null}",
            "{\"column\": \"3\", \"moveCount\": 0}",
            "{\"column\": 3, \"moveCount\": \"0\"}",
            "{\"column\": 3.5, \"moveCount\": 0}",
            "{\"column\": 3.0, \"moveCount\": 0}",
            "{\"column\": 3, \"moveCount\": 0.5}",
            "{\"column\": true, \"moveCount\": 0}",
            "{\"column\": 4294967299, \"moveCount\": 0}",
            "{\"column\": 3, \"moveCount\": 4294967296}",
            "{\"column\": 3, \"moveCount\": 0} extra"})
    void rejectsABadBody(String body) throws Exception {
        String id = newGame();

        expectRejectedWithoutChange(id, () -> send(id, body), 400, "INVALID_REQUEST");
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 1, 41})
    void rejectsAMoveCountThatDoesNotMatch(int moveCount) throws Exception {
        String id = newGame();

        expectRejectedWithoutChange(id, () -> move(id, 3, moveCount), 409, "STALE_MOVE");
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 7, 100})
    void rejectsAColumnOutsideTheBoard(int column) throws Exception {
        String id = newGame();

        expectRejectedWithoutChange(id, () -> move(id, column, 0), 400, "INVALID_COLUMN");
    }

    @Test
    void rejectsAFullColumn() throws Exception {
        String id = newGame();
        for (int count = 0; count < 6; count++) {
            move(id, 0, count).andExpect(status().isOk());
        }

        expectRejectedWithoutChange(id, () -> move(id, 0, 6), 409, "COLUMN_FULL");
    }

    @Test
    void rejectsAMoveAfterTheGameIsOver() throws Exception {
        String id = playToRedWin();

        expectRejectedWithoutChange(id, () -> move(id, 4, 7), 409, "GAME_OVER");
    }

    @Test
    void anUnknownGameIsNotFound() throws Exception {
        expectError(move(UUID.randomUUID().toString(), 3, 0), 404, "GAME_NOT_FOUND");
    }

    @Test
    void rejectsAnIdThatIsNotAUuid() throws Exception {
        expectError(move("abc", 3, 0), 400, "INVALID_REQUEST");
    }

    // ---------- when several rules are broken, the first check wins ----------

    @Test
    void anInvalidRequestComesBeforeAMissingGame() throws Exception {
        expectError(send(UUID.randomUUID().toString(), "{}"), 400, "INVALID_REQUEST");
    }

    @Test
    void aMissingGameComesBeforeAStaleMoveCount() throws Exception {
        expectError(move(UUID.randomUUID().toString(), 100, 99), 404, "GAME_NOT_FOUND");
    }

    @Test
    void aStaleMoveCountComesBeforeGameOver() throws Exception {
        expectError(move(playToRedWin(), 4, 6), 409, "STALE_MOVE");
    }

    @Test
    void aStaleMoveCountComesBeforeAnInvalidColumn() throws Exception {
        expectError(move(newGame(), 100, 5), 409, "STALE_MOVE");
    }

    @Test
    void gameOverComesBeforeAnInvalidColumn() throws Exception {
        expectError(move(playToRedWin(), 100, 7), 409, "GAME_OVER");
    }

    // ---------- helpers ----------

    private interface Request {
        ResultActions send() throws Exception;
    }

    private String newGame() throws Exception {
        String body = mvc.perform(post("/api/games")).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    private String playToRedWin() throws Exception {
        String id = newGame();
        int[] columns = {0, 0, 1, 1, 2, 2, 3};
        for (int count = 0; count < columns.length; count++) {
            move(id, columns[count], count).andExpect(status().isOk());
        }
        return id;
    }

    private ResultActions move(String id, int column, int moveCount) throws Exception {
        return send(id, "{\"column\": %d, \"moveCount\": %d}".formatted(column, moveCount));
    }

    private ResultActions send(String id, String body) throws Exception {
        return mvc.perform(post("/api/games/{id}/moves", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private String load(String id) throws Exception {
        return mvc.perform(get("/api/games/{id}", id)).andReturn().getResponse().getContentAsString();
    }

    private List<String> recordedMoves(String id) {
        return jdbc.sql("""
                        SELECT move_number || ' ' || player || ' ' || col FROM moves
                        WHERE game_id = ? ORDER BY move_number
                        """)
                .param(UUID.fromString(id))
                .query(String.class)
                .list();
    }

    private static void expectError(ResultActions result, int code, String errorCode) throws Exception {
        String message = switch (errorCode) {
            case "INVALID_REQUEST" -> "That request wasn't valid.";
            case "GAME_NOT_FOUND" -> "We couldn't find that game.";
            case "STALE_MOVE" -> "The game has changed. Check the board and try again.";
            case "GAME_OVER" -> "This game is already over.";
            case "INVALID_COLUMN" -> "That column doesn't exist.";
            case "COLUMN_FULL" -> "That column is full.";
            default -> throw new IllegalArgumentException(errorCode);
        };
        result.andExpect(status().is(code))
                .andExpect(content().json(
                        "{\"error\": {\"code\": \"%s\", \"message\": \"%s\"}}".formatted(errorCode, message),
                        JsonCompareMode.STRICT));
    }

    private void expectRejectedWithoutChange(String id, Request request, int code, String errorCode)
            throws Exception {
        String gameBefore = load(id);
        List<String> movesBefore = recordedMoves(id);

        expectError(request.send(), code, errorCode);

        assertEquals(gameBefore, load(id));
        assertEquals(movesBefore, recordedMoves(id));
    }
}
