package com.example.connectfour.game;

import java.util.Arrays;

/** An unchangeable 6 x 7 grid, addressed as [row][col] with row 0 at the top. */
public final class Board {

    public static final int ROWS = 6;
    public static final int COLUMNS = 7;

    private final Cell[][] cells;

    // Callers must pass an array that nothing else holds a reference to.
    private Board(Cell[][] cells) {
        this.cells = cells;
    }

    public static Board empty() {
        Cell[][] cells = new Cell[ROWS][COLUMNS];
        for (Cell[] row : cells) {
            Arrays.fill(row, Cell.EMPTY);
        }
        return new Board(cells);
    }

    public static Board of(Cell[][] cells) {
        if (cells.length != ROWS) {
            throw new IllegalArgumentException("A board needs " + ROWS + " rows");
        }
        for (Cell[] row : cells) {
            if (row == null || row.length != COLUMNS || Arrays.asList(row).contains(null)) {
                throw new IllegalArgumentException("Each row needs " + COLUMNS + " cells");
            }
        }
        return new Board(copy(cells));
    }

    public Cell cellAt(int row, int col) {
        return cells[row][col];
    }

    /** Returns a new board with one cell replaced. This board stays as it was. */
    public Board with(int row, int col, Cell cell) {
        Cell[][] changed = copy(cells);
        changed[row][col] = cell;
        return new Board(changed);
    }

    public Cell[][] toArray() {
        return copy(cells);
    }

    private static Cell[][] copy(Cell[][] source) {
        Cell[][] result = new Cell[source.length][];
        for (int row = 0; row < source.length; row++) {
            result[row] = source[row].clone();
        }
        return result;
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof Board board && Arrays.deepEquals(cells, board.cells);
    }

    @Override
    public int hashCode() {
        return Arrays.deepHashCode(cells);
    }

    @Override
    public String toString() {
        StringBuilder text = new StringBuilder();
        for (Cell[] row : cells) {
            text.append('\n');
            for (Cell cell : row) {
                text.append(cell == Cell.EMPTY ? "." : cell.name().substring(0, 1));
            }
        }
        return text.toString();
    }
}
