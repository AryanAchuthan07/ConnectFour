package com.example.connectfour.game;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;

/** Part 1: starting a game and making ordinary moves. */
class GameMovesTest {

    @Test
    void newGameIsEmptyWithRedToMove() {
        GameState game = Game.newGame();

        assertEquals(Board.empty(), game.board());
        assertEquals(Player.RED, game.currentPlayer());
        assertEquals(GameStatus.IN_PROGRESS, game.status());
        assertEquals(List.of(), game.winningCells());
        assertEquals(0, game.moveCount());
    }

    @Test
    void firstPieceFallsToTheBottomRow() {
        GameState after = Game.applyMove(Game.newGame(), 3);

        assertEquals(Board.empty().with(5, 3, Cell.RED), after.board());
        assertEquals(Player.YELLOW, after.currentPlayer());
        assertEquals(GameStatus.IN_PROGRESS, after.status());
        assertEquals(List.of(), after.winningCells());
        assertEquals(1, after.moveCount());
    }

    @Test
    void piecesStackAndTurnsAlternate() {
        GameState game = Game.newGame();
        game = Game.applyMove(game, 0);
        game = Game.applyMove(game, 0);
        game = Game.applyMove(game, 0);

        Board expected = Board.empty()
                .with(5, 0, Cell.RED)
                .with(4, 0, Cell.YELLOW)
                .with(3, 0, Cell.RED);
        assertEquals(expected, game.board());
        assertEquals(Player.YELLOW, game.currentPlayer());
        assertEquals(3, game.moveCount());
    }

    @Test
    void applyingAMoveLeavesTheOldStateUnchanged() {
        GameState before = Game.newGame();

        Game.applyMove(before, 6);

        assertEquals(Board.empty(), before.board());
        assertEquals(Player.RED, before.currentPlayer());
        assertEquals(0, before.moveCount());
    }
}
