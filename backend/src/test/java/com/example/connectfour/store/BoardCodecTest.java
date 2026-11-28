package com.example.connectfour.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.example.connectfour.game.Board;
import com.example.connectfour.game.Cell;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class BoardCodecTest {

    private static final String EMPTY = ".......".repeat(6);

    // A different cell in three corners and one inside, so swapped rows or columns would show.
    private static final String MARKED =
            "R......"
            + "......."
            + "..Y...."
            + "......."
            + "......."
            + "Y.....R";

    private static final Board MARKED_BOARD = Board.empty()
            .with(0, 0, Cell.RED)
            .with(2, 2, Cell.YELLOW)
            .with(5, 0, Cell.YELLOW)
            .with(5, 6, Cell.RED);

    @Test
    void encodesAnEmptyBoardAs42Dots() {
        assertEquals(EMPTY, BoardCodec.encode(Board.empty()));
    }

    @Test
    void encodesRowByRowStartingAtTheTop() {
        assertEquals(MARKED, BoardCodec.encode(MARKED_BOARD));
    }

    @Test
    void decodesRowByRowStartingAtTheTop() {
        assertEquals(MARKED_BOARD, BoardCodec.decode(MARKED));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "R", "..........................................."})
    void rejectsTheWrongLength(String text) {
        assertThrows(IllegalArgumentException.class, () -> BoardCodec.decode(text));
    }

    @Test
    void rejectsAnUnknownCharacter() {
        String bad = "x" + EMPTY.substring(1);

        assertThrows(IllegalArgumentException.class, () -> BoardCodec.decode(bad));
    }
}
