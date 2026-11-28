package com.example.connectfour.game;

import java.util.List;

/** Everything about a game at one moment. Winning cells are empty unless someone has won. */
public record GameState(
        Board board, Player currentPlayer, GameStatus status, List<Position> winningCells, int moveCount) {

    public GameState {
        winningCells = List.copyOf(winningCells);
    }
}
