package com.example.connectfour.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Part 2: columns that can't be played. */
class RejectedColumnTest {

    @ParameterizedTest
    @ValueSource(ints = {-1, 7, 100, Integer.MIN_VALUE, Integer.MAX_VALUE})
    void rejectsAColumnOutsideTheBoard(int column) {
        GameState game = Game.newGame();

        IllegalMoveException rejected =
                assertThrows(IllegalMoveException.class, () -> Game.applyMove(game, column));

        assertEquals(MoveError.INVALID_COLUMN, rejected.error());
        assertEquals(Game.newGame(), game);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 3, 6})
    void rejectsAFullColumn(int column) {
        GameState game = Game.newGame();
        for (int i = 0; i < 6; i++) {
            game = Game.applyMove(game, column);
        }
        GameState full = game;

        IllegalMoveException rejected =
                assertThrows(IllegalMoveException.class, () -> Game.applyMove(full, column));

        assertEquals(MoveError.COLUMN_FULL, rejected.error());
        assertEquals(6, full.moveCount());
        assertEquals(Player.RED, full.currentPlayer());
    }

    @Test
    void aFullColumnDoesNotBlockTheOthers() {
        GameState game = Game.newGame();
        for (int i = 0; i < 6; i++) {
            game = Game.applyMove(game, 0);
        }

        GameState after = Game.applyMove(game, 1);

        assertEquals(Cell.RED, after.board().cellAt(5, 1));
    }
}
