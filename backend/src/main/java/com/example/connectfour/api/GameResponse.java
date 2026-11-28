package com.example.connectfour.api;

import com.example.connectfour.game.Board;
import com.example.connectfour.game.GameState;
import com.example.connectfour.game.Player;
import com.example.connectfour.game.Position;
import com.example.connectfour.store.StoredGame;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/** The game object every game endpoint returns. */
record GameResponse(
        UUID id, String[][] board, String currentPlayer, String status, int[][] winningCells, int moveCount) {

    static GameResponse from(StoredGame game) {
        GameState state = game.state();
        return new GameResponse(
                game.id(),
                rows(state.board()),
                state.currentPlayer() == Player.RED ? "R" : "Y",
                state.status().name().toLowerCase(Locale.ROOT),
                cells(state.winningCells()),
                state.moveCount());
    }

    private static String[][] rows(Board board) {
        String[][] rows = new String[Board.ROWS][Board.COLUMNS];
        for (int row = 0; row < Board.ROWS; row++) {
            for (int col = 0; col < Board.COLUMNS; col++) {
                rows[row][col] = switch (board.cellAt(row, col)) {
                    case EMPTY -> ".";
                    case RED -> "R";
                    case YELLOW -> "Y";
                };
            }
        }
        return rows;
    }

    // null, not an empty list, unless someone has won.
    private static int[][] cells(List<Position> positions) {
        if (positions.isEmpty()) {
            return null;
        }
        return positions.stream()
                .map(position -> new int[] {position.row(), position.col()})
                .toArray(int[][]::new);
    }
}
