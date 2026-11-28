package com.example.connectfour.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class BoardTest {

    @Test
    void emptyBoardHasSixRowsOfSevenEmptyCells() {
        Cell[][] cells = Board.empty().toArray();

        assertEquals(6, cells.length);
        for (Cell[] row : cells) {
            assertEquals(7, row.length);
            for (Cell cell : row) {
                assertEquals(Cell.EMPTY, cell);
            }
        }
    }

    @Test
    void placingAPieceReturnsANewBoardAndLeavesTheOldOneUnchanged() {
        Board before = Board.empty();

        Board after = before.with(5, 3, Cell.RED);

        assertEquals(Cell.RED, after.cellAt(5, 3));
        assertEquals(Cell.EMPTY, before.cellAt(5, 3));
    }

    @Test
    void changingTheSourceArrayDoesNotChangeTheBoard() {
        Cell[][] source = Board.empty().toArray();
        Board board = Board.of(source);

        source[0][0] = Cell.RED;

        assertEquals(Cell.EMPTY, board.cellAt(0, 0));
    }

    @Test
    void changingTheReturnedArrayDoesNotChangeTheBoard() {
        Board board = Board.empty();

        board.toArray()[0][0] = Cell.RED;

        assertEquals(Cell.EMPTY, board.cellAt(0, 0));
    }

    @Test
    void rejectsArraysOfTheWrongSize() {
        assertThrows(IllegalArgumentException.class, () -> Board.of(new Cell[5][7]));
        assertThrows(IllegalArgumentException.class, () -> Board.of(new Cell[6][6]));
    }

    @Test
    void rejectsMissingCells() {
        Cell[][] cells = Board.empty().toArray();
        cells[2][4] = null;

        assertThrows(IllegalArgumentException.class, () -> Board.of(cells));
    }

    @Test
    void boardsWithTheSameCellsAreEqual() {
        Board one = Board.empty().with(5, 0, Cell.RED);
        Board same = Board.empty().with(5, 0, Cell.RED);

        assertEquals(one, same);
        assertEquals(one.hashCode(), same.hashCode());
        assertNotEquals(one, Board.empty());
    }
}
