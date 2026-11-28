package com.example.connectfour.api;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.connectfour.game.Game;
import com.example.connectfour.store.GameStore;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
class OtherErrorsTest {

    private static final String ID = "3f2b8c1e-9d4a-4e7b-a1c6-5f0d2e8b9a34";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private GameStore store;

    @Autowired
    private JdbcClient jdbc;

    private static void expectError(ResultActions result, int code, String errorCode, String message)
            throws Exception {
        result.andExpect(status().is(code))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(content().json(
                        "{\"error\": {\"code\": \"%s\", \"message\": \"%s\"}}".formatted(errorCode, message),
                        JsonCompareMode.STRICT));
    }

    @Test
    void anUnexpectedFailureReturnsASafe500() throws Exception {
        UUID id = store.create(Game.newGame()).id();
        // Valid JSON in the wrong shape, so reading the game fails in a way no rule expects.
        jdbc.sql("UPDATE games SET winning_cells = '{\"unexpected\": true}'::jsonb WHERE id = ?")
                .param(id)
                .update();
        try {
            // STRICT matching also proves no exception details are included.
            expectError(mvc.perform(get("/api/games/{id}", id)),
                    500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
        } finally {
            jdbc.sql("UPDATE games SET winning_cells = NULL WHERE id = ?").param(id).update();
        }
    }

    @ParameterizedTest
    @CsvSource({
            "GET, /api",
            "GET, /api/nothing",
            "POST, /api/nothing",
            "GET, /api/games/" + ID + "/nothing",
            "POST, /api/games/" + ID + "/moves/extra"})
    void anUnknownApiPathUsesTheErrorShape(String method, String path) throws Exception {
        expectError(mvc.perform(request(HttpMethod.valueOf(method), path)),
                404, "NOT_FOUND", "We couldn't find that.");
    }

    @ParameterizedTest
    @CsvSource({
            "GET, /api/games, POST",
            "DELETE, /api/games/" + ID + ", GET",
            "GET, /api/games/" + ID + "/moves, POST",
            "PUT, /api/games/" + ID + "/moves, POST"})
    void aWrongMethodUsesTheErrorShape(String method, String path, String allowed) throws Exception {
        ResultActions result = mvc.perform(request(HttpMethod.valueOf(method), path));

        expectError(result, 405, "METHOD_NOT_ALLOWED", "That action isn't allowed.");
        result.andExpect(header().string("Allow", org.hamcrest.Matchers.containsString(allowed)));
    }

    @Test
    void anotherKindOfBadRequestIsNotReportedAsAServerFailure() throws Exception {
        UUID id = store.create(Game.newGame()).id();

        int code = mvc.perform(get("/api/games/{id}", id).accept(MediaType.TEXT_XML))
                .andReturn().getResponse().getStatus();

        assertTrue(code >= 400 && code < 500, "status was " + code);
    }
}
