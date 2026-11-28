package com.example.connectfour.game;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.SortedSet;
import java.util.TreeSet;

/** The rules of Connect 4. */
public final class Game {

    private static final int LINE_TO_WIN = 4;

    // One step along each line through a cell, as {row, col}: horizontal, vertical and both diagonals.
    private static final int[][] DIRECTIONS = {{0, 1}, {1, 0}, {1, 1}, {1, -1}};

    private static final Comparator<Position> BY_ROW_THEN_COLUMN =
            Comparator.comparingInt(Position::row).thenComparingInt(Position::col);

    private Game() {
    }

    public static GameState newGame() {
        return new GameState(Board.empty(), Player.RED, GameStatus.IN_PROGRESS, List.of(), 0);
    }

    /**
     * Returns the state after the current player plays this column. The old state is unchanged.
     *
     * @throws IllegalMoveException if the move isn't allowed. The checks run in a fixed order:
     *     game over, then invalid column, then full column.
     */
    public static GameState applyMove(GameState state, int column) {
        if (state.status() != GameStatus.IN_PROGRESS) {
            throw new IllegalMoveException(MoveError.GAME_OVER);
        }
        if (column < 0 || column >= Board.COLUMNS) {
            throw new IllegalMoveException(MoveError.INVALID_COLUMN);
        }
        if (state.board().cellAt(0, column) != Cell.EMPTY) {
            throw new IllegalMoveException(MoveError.COLUMN_FULL);
        }

        Player player = state.currentPlayer();
        Position placed = new Position(lowestEmptyRow(state.board(), column), column);
        Board board = state.board().with(placed.row(), placed.col(), player.cell());
        int moveCount = state.moveCount() + 1;

        List<Position> winningCells = winningCells(board, placed);
        if (!winningCells.isEmpty()) {
            GameStatus won = player == Player.RED ? GameStatus.RED_WON : GameStatus.YELLOW_WON;
            return new GameState(board, player, won, winningCells, moveCount);
        }
        // Checked after the win, so a winning last move isn't called a draw.
        if (isFull(board)) {
            return new GameState(board, player, GameStatus.DRAW, List.of(), moveCount);
        }
        return new GameState(board, player.other(), GameStatus.IN_PROGRESS, List.of(), moveCount);
    }

    // Pieces stack from the bottom, so the board is full once every top cell is taken.
    private static boolean isFull(Board board) {
        for (int column = 0; column < Board.COLUMNS; column++) {
            if (board.cellAt(0, column) == Cell.EMPTY) {
                return false;
            }
        }
        return true;
    }

    private static int lowestEmptyRow(Board board, int column) {
        int row = Board.ROWS - 1;
        while (board.cellAt(row, column) != Cell.EMPTY) {
            row--;
        }
        return row;
    }

    /**
     * Every cell in every line of four or more through the piece just placed, without duplicates,
     * sorted by row and then column. Only lines through that piece can be new.
     */
    private static List<Position> winningCells(Board board, Position placed) {
        SortedSet<Position> winning = new TreeSet<>(BY_ROW_THEN_COLUMN);
        for (int[] direction : DIRECTIONS) {
            List<Position> line = new ArrayList<>();
            line.add(placed);
            line.addAll(matchingFrom(board, placed, direction[0], direction[1]));
            line.addAll(matchingFrom(board, placed, -direction[0], -direction[1]));
            if (line.size() >= LINE_TO_WIN) {
                winning.addAll(line);
            }
        }
        return List.copyOf(winning);
    }

    /** The unbroken run of the same colour next to {@code start}, walking one way. */
    private static List<Position> matchingFrom(Board board, Position start, int rowStep, int colStep) {
        Cell colour = board.cellAt(start.row(), start.col());
        List<Position> run = new ArrayList<>();
        int row = start.row() + rowStep;
        int col = start.col() + colStep;
        while (row >= 0 && row < Board.ROWS && col >= 0 && col < Board.COLUMNS
                && board.cellAt(row, col) == colour) {
            run.add(new Position(row, col));
            row += rowStep;
            col += colStep;
        }
        return run;
    }
}
