package com.example.connectfour.game;

import static com.example.connectfour.game.TestBoards.inProgress;
import static com.example.connectfour.game.TestBoards.positions;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Part 4: how games end, what's rejected afterwards, and which rejection comes first. */
class GameEndingTest {

    /** One empty cell, top left. Yellow's 42nd move fills it without making four. */
    private static GameState oneMoveFromADraw() {
        return inProgress(
                ".YRRYYR",
                "RRYYRRY",
                "YYRRYYR",
                "RRYYRRY",
                "YYRRYYR",
                "RRYYRRY");
    }

    private static GameState play(int... columns) {
        GameState game = Game.newGame();
        for (int column : columns) {
            game = Game.applyMove(game, column);
        }
        return game;
    }

    // Both games first fill column 6, so each finished game also has a full column.
    private static GameState redWonWithColumnSixFull() {
        return play(6, 6, 6, 6, 6, 6, 0, 0, 1, 1, 2, 2, 3);
    }

    private static GameState yellowWon() {
        return play(0, 1, 0, 1, 2, 1, 6, 1);
    }

    private static MoveError rejectionOf(GameState game, int column) {
        return assertThrows(IllegalMoveException.class, () -> Game.applyMove(game, column)).error();
    }

    @Test
    void fillingTheBoardWithoutFourIsADraw() {
        GameState after = Game.applyMove(oneMoveFromADraw(), 0);

        assertEquals(GameStatus.DRAW, after.status());
        assertEquals(List.of(), after.winningCells());
        assertEquals(42, after.moveCount());
        assertEquals(Player.YELLOW, after.currentPlayer());
    }

    @Test
    void winningWithTheFortySecondMoveIsAWinNotADraw() {
        GameState before = inProgress(
                ".YYYRRR",
                "YRRRYYR",
                "RYYRYRY",
                "RYRYYRR",
                "RYRRRYY",
                "YRYYRRY");

        GameState after = Game.applyMove(before, 0);

        assertEquals(GameStatus.YELLOW_WON, after.status());
        assertEquals(positions("0,0 0,1 0,2 0,3"), after.winningCells());
        assertEquals(42, after.moveCount());
        assertEquals(Player.YELLOW, after.currentPlayer());
    }

    @Test
    void theTurnStaysWithTheWinner() {
        assertEquals(GameStatus.RED_WON, redWonWithColumnSixFull().status());
        assertEquals(Player.RED, redWonWithColumnSixFull().currentPlayer());
        assertEquals(GameStatus.YELLOW_WON, yellowWon().status());
        assertEquals(Player.YELLOW, yellowWon().currentPlayer());
    }

    @Test
    void noMovesAfterRedWins() {
        GameState won = redWonWithColumnSixFull();

        assertEquals(MoveError.GAME_OVER, rejectionOf(won, 4));
        assertEquals(13, won.moveCount());
        assertEquals(Cell.EMPTY, won.board().cellAt(5, 4));
    }

    @Test
    void noMovesAfterYellowWins() {
        assertEquals(MoveError.GAME_OVER, rejectionOf(yellowWon(), 4));
    }

    // After a draw every column is also full, so this checks the error order too.
    @ParameterizedTest
    @ValueSource(ints = {0, 3, 6})
    void noMovesAfterADraw(int column) {
        GameState drawn = Game.applyMove(oneMoveFromADraw(), 0);

        assertEquals(MoveError.GAME_OVER, rejectionOf(drawn, column));
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 7, 100})
    void gameOverComesBeforeAnInvalidColumn(int column) {
        assertEquals(MoveError.GAME_OVER, rejectionOf(redWonWithColumnSixFull(), column));
    }

    @Test
    void gameOverComesBeforeAFullColumn() {
        assertEquals(MoveError.GAME_OVER, rejectionOf(redWonWithColumnSixFull(), 6));
    }
}
