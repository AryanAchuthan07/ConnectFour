package com.example.connectfour.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.example.connectfour.game.Board;
import com.example.connectfour.game.Cell;
import com.example.connectfour.game.Game;
import com.example.connectfour.game.GameState;
import com.example.connectfour.game.GameStatus;
import com.example.connectfour.game.Player;
import com.example.connectfour.game.Position;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;

/** Runs against real Postgres. Each test creates its own game, so existing rows don't matter. */
@SpringBootTest
class GameStoreTest {

    @Autowired
    private GameStore store;

    @Autowired
    private JdbcClient jdbc;

    static Stream<GameState> statesToStore() {
        Board onePiece = Board.empty().with(5, 3, Cell.RED);
        List<Position> diagonal = List.of(
                new Position(2, 0), new Position(3, 1), new Position(4, 2), new Position(5, 3));
        return Stream.of(
                Game.newGame(),
                Game.applyMove(Game.newGame(), 3),
                new GameState(onePiece, Player.RED, GameStatus.RED_WON, diagonal, 7),
                new GameState(onePiece, Player.YELLOW, GameStatus.YELLOW_WON, diagonal, 8),
                new GameState(onePiece, Player.YELLOW, GameStatus.DRAW, List.of(), 42));
    }

    @ParameterizedTest
    @MethodSource("statesToStore")
    void aCreatedGameLoadsBackUnchanged(GameState state) {
        StoredGame created = store.create(state);

        assertEquals(state, created.state());
        assertEquals(Optional.of(created), store.find(created.id()));
    }

    @Test
    void everyGameGetsItsOwnId() {
        assertTrue(!store.create(Game.newGame()).id().equals(store.create(Game.newGame()).id()));
    }

    @Test
    void anUnknownGameIsNotFound() {
        assertEquals(Optional.empty(), store.find(UUID.randomUUID()));
    }

    @Test
    void updatingSavesTheNewStateAndTime() {
        StoredGame created = store.create(Game.newGame());
        OffsetDateTime before = updatedAt(created.id());
        StoredGame moved = new StoredGame(created.id(), Game.applyMove(created.state(), 0));

        store.update(moved);

        assertEquals(Optional.of(moved), store.find(created.id()));
        assertTrue(updatedAt(created.id()).isAfter(before));
    }

    @Test
    void updatingAnUnknownGameFails() {
        StoredGame missing = new StoredGame(UUID.randomUUID(), Game.newGame());

        assertThrows(IllegalStateException.class, () -> store.update(missing));
    }

    @Test
    void recordsAMove() {
        UUID id = store.create(Game.newGame()).id();

        store.recordMove(id, 1, Player.RED, 3);

        String row = jdbc.sql("SELECT move_number || ' ' || player || ' ' || col FROM moves WHERE game_id = ?")
                .param(id)
                .query(String.class)
                .single();
        assertEquals("1 R 3", row);
    }

    @Test
    void theSameMoveNumberCannotBeRecordedTwice() {
        UUID id = store.create(Game.newGame()).id();
        store.recordMove(id, 1, Player.RED, 3);

        assertThrows(DuplicateKeyException.class, () -> store.recordMove(id, 1, Player.YELLOW, 4));
    }

    @Test
    void aMoveNeedsAnExistingGame() {
        assertThrows(DataIntegrityViolationException.class,
                () -> store.recordMove(UUID.randomUUID(), 1, Player.RED, 3));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "board = 'R'",
            "board = repeat('x', 42)",
            "current_player = 'G'",
            "status = 'finished'",
            "move_count = -1",
            "move_count = 43"})
    void theGamesTableRejectsInvalidValues(String assignment) {
        UUID id = store.create(Game.newGame()).id();

        assertThrows(DataIntegrityViolationException.class,
                () -> jdbc.sql("UPDATE games SET " + assignment + " WHERE id = ?").param(id).update());
    }

    @ParameterizedTest
    @ValueSource(strings = {"0, 'R', 3", "43, 'R', 3", "1, 'G', 3", "1, 'R', -1", "1, 'R', 7"})
    void theMovesTableRejectsInvalidValues(String values) {
        UUID id = store.create(Game.newGame()).id();

        assertThrows(DataIntegrityViolationException.class,
                () -> jdbc.sql("INSERT INTO moves (game_id, move_number, player, col) VALUES (?, " + values + ")")
                        .param(id)
                        .update());
    }

    private OffsetDateTime updatedAt(UUID id) {
        return jdbc.sql("SELECT updated_at FROM games WHERE id = ?")
                .param(id)
                .query(OffsetDateTime.class)
                .single();
    }
}
