package com.example.connectfour.game;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Builds test positions from diagrams, top row first: R, Y or '.' for empty. */
final class TestBoards {

    private TestBoards() {
    }

    /**
     * An unfinished game showing the given position. Rejects diagrams that couldn't be a real
     * unfinished game, so a typo can't quietly weaken a test. It doesn't prove that a sequence
     * of moves reaches the position.
     */
    static GameState inProgress(String... rows) {
        Board board = board(rows);
        int red = count(board, Cell.RED);
        int yellow = count(board, Cell.YELLOW);
        if (red != yellow && red != yellow + 1) {
            throw new IllegalArgumentException("Impossible counts: " + red + " red, " + yellow + " yellow");
        }
        if (hasFourInARow(board)) {
            throw new IllegalArgumentException("Diagram already has four in a row:" + board);
        }
        Player toMove = red == yellow ? Player.RED : Player.YELLOW;
        return new GameState(board, toMove, GameStatus.IN_PROGRESS, List.of(), red + yellow);
    }

    static Board board(String... rows) {
        if (rows.length != Board.ROWS) {
            throw new IllegalArgumentException("A diagram needs " + Board.ROWS + " rows");
        }
        Cell[][] cells = new Cell[Board.ROWS][Board.COLUMNS];
        for (int row = 0; row < Board.ROWS; row++) {
            if (rows[row].length() != Board.COLUMNS) {
                throw new IllegalArgumentException("Wrong width: " + rows[row]);
            }
            for (int col = 0; col < Board.COLUMNS; col++) {
                cells[row][col] = switch (rows[row].charAt(col)) {
                    case 'R' -> Cell.RED;
                    case 'Y' -> Cell.YELLOW;
                    case '.' -> Cell.EMPTY;
                    default -> throw new IllegalArgumentException("Unknown cell in " + rows[row]);
                };
            }
        }
        Board board = Board.of(cells);
        for (int row = 0; row < Board.ROWS - 1; row++) {
            for (int col = 0; col < Board.COLUMNS; col++) {
                if (board.cellAt(row, col) != Cell.EMPTY && board.cellAt(row + 1, col) == Cell.EMPTY) {
                    throw new IllegalArgumentException("Floating piece at " + row + "," + col);
                }
            }
        }
        return board;
    }

    /** Parses "5,0 5,1" into positions, so expected cells are written out by hand. */
    static List<Position> positions(String text) {
        List<Position> result = new ArrayList<>();
        for (String pair : text.trim().split("\\s+")) {
            String[] parts = pair.split(",");
            result.add(new Position(Integer.parseInt(parts[0]), Integer.parseInt(parts[1])));
        }
        return result;
    }

    private static int count(Board board, Cell wanted) {
        return (int) Arrays.stream(board.toArray()).flatMap(Arrays::stream).filter(wanted::equals).count();
    }

    // Deliberately brute force and separate from the game's own win check: it tests every
    // group of four on the board.
    private static boolean hasFourInARow(Board board) {
        int[][] directions = {{0, 1}, {1, 0}, {1, 1}, {1, -1}};
        for (int row = 0; row < Board.ROWS; row++) {
            for (int col = 0; col < Board.COLUMNS; col++) {
                for (int[] d : directions) {
                    int endRow = row + 3 * d[0];
                    int endCol = col + 3 * d[1];
                    Cell first = board.cellAt(row, col);
                    if (first == Cell.EMPTY || endRow >= Board.ROWS || endCol < 0 || endCol >= Board.COLUMNS) {
                        continue;
                    }
                    int matching = 1;
                    while (matching < 4 && board.cellAt(row + matching * d[0], col + matching * d[1]) == first) {
                        matching++;
                    }
                    if (matching == 4) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
