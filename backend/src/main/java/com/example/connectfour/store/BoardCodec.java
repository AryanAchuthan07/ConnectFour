package com.example.connectfour.store;

import com.example.connectfour.game.Board;
import com.example.connectfour.game.Cell;

/**
 * The storage format for a board: 42 characters, row by row from the top, each '.', 'R' or 'Y'.
 * Nothing outside this package sees it.
 */
final class BoardCodec {

    private static final int LENGTH = Board.ROWS * Board.COLUMNS;

    private BoardCodec() {
    }

    static String encode(Board board) {
        StringBuilder text = new StringBuilder(LENGTH);
        for (int row = 0; row < Board.ROWS; row++) {
            for (int col = 0; col < Board.COLUMNS; col++) {
                text.append(switch (board.cellAt(row, col)) {
                    case EMPTY -> '.';
                    case RED -> 'R';
                    case YELLOW -> 'Y';
                });
            }
        }
        return text.toString();
    }

    static Board decode(String text) {
        if (text.length() != LENGTH) {
            throw new IllegalArgumentException("A stored board has " + LENGTH + " characters, not " + text.length());
        }
        Cell[][] cells = new Cell[Board.ROWS][Board.COLUMNS];
        for (int i = 0; i < LENGTH; i++) {
            cells[i / Board.COLUMNS][i % Board.COLUMNS] = switch (text.charAt(i)) {
                case '.' -> Cell.EMPTY;
                case 'R' -> Cell.RED;
                case 'Y' -> Cell.YELLOW;
                default -> throw new IllegalArgumentException("Unknown cell character: " + text.charAt(i));
            };
        }
        return Board.of(cells);
    }
}
