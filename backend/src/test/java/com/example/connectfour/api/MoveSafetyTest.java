package com.example.connectfour.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.example.connectfour.game.Game;
import com.example.connectfour.store.GameStore;
import com.example.connectfour.store.StoredGame;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;

// Not @Transactional: the requests must commit and compete the way real ones do.
@SpringBootTest
@AutoConfigureMockMvc
class MoveSafetyTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private GameStore store;

    @Autowired
    private JdbcClient jdbc;

    @Autowired
    private DataSource dataSource;

    /**
     * Starting two requests together doesn't guarantee they overlap. So the test locks the game
     * first, waits until the database shows both requests stuck, and only then lets them go.
     */
    @Test
    void twoMovesAtTheSameTimePlayOnlyOnce() throws Exception {
        UUID id = store.create(Game.newGame()).id();
        ExecutorService requests = Executors.newFixedThreadPool(2);
        try {
            Future<MockHttpServletResponse> first;
            Future<MockHttpServletResponse> second;
            try (Connection holder = dataSource.getConnection()) {
                holder.setAutoCommit(false);
                try (PreparedStatement lock =
                        holder.prepareStatement("SELECT 1 FROM games WHERE id = ? FOR UPDATE")) {
                    lock.setObject(1, id);
                    lock.executeQuery();
                    first = requests.submit(() -> sendMove(id));
                    second = requests.submit(() -> sendMove(id));
                    waitUntilBlocked(2);
                } finally {
                    holder.rollback();
                    holder.setAutoCommit(true);
                }
            }

            List<MockHttpServletResponse> responses =
                    List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS));

            assertEquals(List.of(200, 409), responses.stream().map(MockHttpServletResponse::getStatus).sorted().toList());
            MockHttpServletResponse rejected =
                    responses.stream().filter(response -> response.getStatus() == 409).findFirst().orElseThrow();
            assertTrue(rejected.getContentAsString().contains("\"code\":\"STALE_MOVE\""), rejected.getContentAsString());
            assertEquals(1, recordedMoves(id));
            assertEquals(1, store.find(id).orElseThrow().state().moveCount());
        } finally {
            requests.shutdownNow();
        }
    }

    /** A trigger that exists only for this test makes the save fail after the move row is inserted. */
    @Test
    void aFailurePartWayThroughSavingKeepsNeitherChange() throws Exception {
        StoredGame game = store.create(Game.newGame());
        String name = "fail_update_" + game.id().toString().replace('-', '_');
        jdbc.sql("""
                CREATE FUNCTION %s() RETURNS trigger LANGUAGE plpgsql AS
                $$ BEGIN RAISE EXCEPTION 'forced failure for a test'; END $$
                """.formatted(name)).update();
        try {
            jdbc.sql("CREATE TRIGGER %s BEFORE UPDATE ON games FOR EACH ROW WHEN (OLD.id = '%s') EXECUTE FUNCTION %s()"
                    .formatted(name, game.id(), name)).update();

            assertTrue(moveFails(game.id()), "the forced failure should make the request fail");

            assertEquals(0, recordedMoves(game.id()));
            assertEquals(game, store.find(game.id()).orElseThrow());
        } finally {
            jdbc.sql("DROP TRIGGER IF EXISTS %s ON games".formatted(name)).update();
            jdbc.sql("DROP FUNCTION %s()".formatted(name)).update();
        }
    }

    // What the response looks like is tested separately. This only needs to know the move failed.
    private boolean moveFails(UUID id) {
        try {
            return sendMove(id).getStatus() >= 500;
        } catch (Exception e) {
            return true;
        }
    }

    private MockHttpServletResponse sendMove(UUID id) throws Exception {
        return mvc.perform(post("/api/games/{id}/moves", id).content("{\"column\": 3, \"moveCount\": 0}"))
                .andReturn()
                .getResponse();
    }

    private int recordedMoves(UUID id) {
        return jdbc.sql("SELECT count(*) FROM moves WHERE game_id = ?").param(id).query(Integer.class).single();
    }

    private void waitUntilBlocked(int expected) throws InterruptedException {
        Instant deadline = Instant.now().plus(Duration.ofSeconds(5));
        while (Instant.now().isBefore(deadline)) {
            int blocked = jdbc.sql("""
                            SELECT count(*) FROM pg_stat_activity
                            WHERE datname = current_database() AND wait_event_type = 'Lock'
                            """)
                    .query(Integer.class)
                    .single();
            if (blocked >= expected) {
                return;
            }
            Thread.sleep(20);
        }
        fail("Expected " + expected + " requests to be waiting on a lock");
    }
}
