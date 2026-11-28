package com.example.connectfour.api;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.connectfour.game.Board;
import com.example.connectfour.game.Cell;
import com.example.connectfour.game.Game;
import com.example.connectfour.game.GameState;
import com.example.connectfour.game.GameStatus;
import com.example.connectfour.game.Player;
import com.example.connectfour.game.Position;
import com.example.connectfour.store.GameStore;
import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
class CreateAndGetGameTest {

    private static final String EMPTY_ROW = "[\".\",\".\",\".\",\".\",\".\",\".\",\".\"]";
    private static final String EMPTY_BOARD = "[" + (EMPTY_ROW + ",").repeat(5) + EMPTY_ROW + "]";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private GameStore store;

    // STRICT: no missing or extra fields.
    private static String newGameJson(String id) {
        return """
                {"id": "%s", "board": %s, "currentPlayer": "R", "status": "in_progress",
                 "winningCells": null, "moveCount": 0}
                """.formatted(id, EMPTY_BOARD);
    }

    private static void expectError(ResultActions result, int code, String errorCode, String message)
            throws Exception {
        result.andExpect(status().is(code))
                .andExpect(content().json(
                        "{\"error\": {\"code\": \"%s\", \"message\": \"%s\"}}".formatted(errorCode, message),
                        JsonCompareMode.STRICT));
    }

    @Test
    void creatingReturns201WithTheNewGame() throws Exception {
        String body = mvc.perform(post("/api/games"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        String id = JsonPath.read(body, "$.id");
        UUID.fromString(id);
        mvc.perform(get("/api/games/{id}", id))
                .andExpect(status().isOk())
                .andExpect(content().json(newGameJson(id), JsonCompareMode.STRICT));
        assertTrue(body.contains("\"winningCells\":null"), body);
    }

    @Test
    void aWonGameShowsTheBoardByRowWithItsWinningCells() throws Exception {
        Board board = Board.empty().with(0, 6, Cell.YELLOW).with(5, 0, Cell.RED);
        GameState won = new GameState(board, Player.RED, GameStatus.RED_WON,
                List.of(new Position(5, 0), new Position(5, 1), new Position(5, 2), new Position(5, 3)), 7);
        UUID id = store.create(won).id();

        mvc.perform(get("/api/games/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.board[0][6]").value("Y"))
                .andExpect(jsonPath("$.board[5][0]").value("R"))
                .andExpect(jsonPath("$.board[0][0]").value("."))
                .andExpect(jsonPath("$.currentPlayer").value("R"))
                .andExpect(jsonPath("$.status").value("red_won"))
                .andExpect(content().json("{\"winningCells\": [[5,0],[5,1],[5,2],[5,3]]}", JsonCompareMode.LENIENT))
                .andExpect(jsonPath("$.winningCells.length()").value(4))
                .andExpect(jsonPath("$.moveCount").value(7));
    }

    @Test
    void acceptsAnUpperCaseId() throws Exception {
        UUID id = store.create(Game.newGame()).id();

        mvc.perform(get("/api/games/{id}", id.toString().toUpperCase(Locale.ROOT)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id.toString()));
    }

    @Test
    void anUnknownGameIsNotFound() throws Exception {
        expectError(mvc.perform(get("/api/games/{id}", UUID.randomUUID())),
                404, "GAME_NOT_FOUND", "We couldn't find that game.");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "123",
            "not-a-game",
            // Java's own UUID parser accepts this one.
            "1-1-1-1-1",
            "3f2b8c1e9d4a4e7ba1c65f0d2e8b9a34",
            "3f2b8c1e-9d4a-4e7b-a1c6-5f0d2e8b9a34x",
            "zf2b8c1e-9d4a-4e7b-a1c6-5f0d2e8b9a34"})
    void rejectsAnIdThatIsNotAUuid(String id) throws Exception {
        expectError(mvc.perform(get("/api/games/{id}", id)),
                400, "INVALID_REQUEST", "That request wasn't valid.");
    }
}
