package com.example.connectfour.game;

import static com.example.connectfour.game.TestBoards.inProgress;
import static com.example.connectfour.game.TestBoards.positions;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Named.named;
import static org.junit.jupiter.params.provider.Arguments.arguments;

import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/** Part 3: finding wins, including every winning cell. Diagrams show the board before the move. */
class WinDetectionTest {

    private static Arguments scenario(String name, GameState before, int column, String expectedCells) {
        return arguments(named(name, before), column, positions(expectedCells));
    }

    private static void assertRedWins(GameState before, int column, List<Position> expected) {
        GameState after = Game.applyMove(before, column);

        assertEquals(GameStatus.RED_WON, after.status());
        assertEquals(expected, after.winningCells());
    }

    static Stream<Arguments> horizontalWins() {
        return Stream.of(
                scenario("bottom left edge", inProgress(
                        ".......",
                        ".......",
                        ".......",
                        ".......",
                        "YYY....",
                        "RRR...."), 3, "5,0 5,1 5,2 5,3"),
                scenario("right edge", inProgress(
                        ".......",
                        ".......",
                        ".......",
                        ".......",
                        "....YYY",
                        "....RRR"), 3, "5,3 5,4 5,5 5,6"),
                scenario("piece placed in the middle of the line", inProgress(
                        ".......",
                        ".......",
                        ".......",
                        ".......",
                        "YY.Y...",
                        "RR.R..."), 2, "5,0 5,1 5,2 5,3"),
                scenario("top row", inProgress(
                        "RRR....",
                        "RRYY...",
                        "YYRR...",
                        "RRYY...",
                        "YYRR.YY",
                        "RRYYRYY"), 3, "0,0 0,1 0,2 0,3"));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource
    void horizontalWins(GameState before, int column, List<Position> expected) {
        assertRedWins(before, column, expected);
    }

    static Stream<Arguments> verticalWins() {
        return Stream.of(
                scenario("bottom left corner", inProgress(
                        ".......",
                        ".......",
                        ".......",
                        "RY.....",
                        "RY.....",
                        "RY....."), 0, "2,0 3,0 4,0 5,0"),
                scenario("reaching the top right corner", inProgress(
                        ".......",
                        "......R",
                        "......R",
                        "......R",
                        "......Y",
                        "Y.....Y"), 6, "0,6 1,6 2,6 3,6"));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource
    void verticalWins(GameState before, int column, List<Position> expected) {
        assertRedWins(before, column, expected);
    }

    static Stream<Arguments> fallingDiagonalWins() {
        return Stream.of(
                scenario("left edge, played at the top end", inProgress(
                        ".......",
                        ".......",
                        ".......",
                        "RR.....",
                        "RYR....",
                        "YYYR..Y"), 0, "2,0 3,1 4,2 5,3"),
                scenario("piece placed in the middle of the line", inProgress(
                        ".......",
                        ".......",
                        "R......",
                        "RR.....",
                        "RY.....",
                        "YYYR..Y"), 2, "2,0 3,1 4,2 5,3"),
                scenario("top left corner", inProgress(
                        ".......",
                        "YR.....",
                        "RYR....",
                        "YRYR...",
                        "RRYR...",
                        "YYRY..Y"), 0, "0,0 1,1 2,2 3,3"));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource
    void fallingDiagonalWins(GameState before, int column, List<Position> expected) {
        assertRedWins(before, column, expected);
    }

    // Mirror images of the falling diagonals.
    static Stream<Arguments> risingDiagonalWins() {
        return Stream.of(
                scenario("right edge, played at the top end", inProgress(
                        ".......",
                        ".......",
                        ".......",
                        ".....RR",
                        "....RYR",
                        "Y..RYYY"), 6, "2,6 3,5 4,4 5,3"),
                scenario("top right corner", inProgress(
                        ".......",
                        ".....RY",
                        "....RYR",
                        "...RYRY",
                        "...RYRR",
                        "Y..YRYY"), 6, "0,6 1,5 2,4 3,3"));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource
    void risingDiagonalWins(GameState before, int column, List<Position> expected) {
        assertRedWins(before, column, expected);
    }

    @Test
    void yellowCanWin() {
        GameState before = inProgress(
                ".......",
                ".......",
                ".......",
                ".......",
                "RRR....",
                "YYY.R..");

        GameState after = Game.applyMove(before, 3);

        assertEquals(GameStatus.IN_PROGRESS, before.status());
        assertEquals(Player.YELLOW, before.currentPlayer());
        assertEquals(GameStatus.YELLOW_WON, after.status());
        assertEquals(positions("5,0 5,1 5,2 5,3"), after.winningCells());
    }

    @Test
    void aGamePlayedFromTheStartCanBeWon() {
        GameState game = Game.newGame();
        for (int column : new int[] {0, 0, 1, 1, 2, 2, 3}) {
            game = Game.applyMove(game, column);
        }

        assertEquals(GameStatus.RED_WON, game.status());
        assertEquals(positions("5,0 5,1 5,2 5,3"), game.winningCells());
        assertEquals(7, game.moveCount());
    }

    static Stream<Arguments> movesThatDoNotWin() {
        return Stream.of(
                arguments(named("only three in a row", inProgress(
                        ".......",
                        ".......",
                        ".......",
                        ".......",
                        "YY.....",
                        "RR.....")), 2),
                arguments(named("four split by a gap", inProgress(
                        ".......",
                        ".......",
                        ".......",
                        ".......",
                        "YY.Y...",
                        "RR.R...")), 4),
                arguments(named("four split by the other colour", inProgress(
                        ".......",
                        ".......",
                        ".......",
                        ".......",
                        "YY.....",
                        "RRY.R..")), 3),
                arguments(named("run continuing from the end of one row onto the next", inProgress(
                        ".......",
                        ".......",
                        ".......",
                        ".......",
                        "Y....RR",
                        "R....YY")), 1));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource
    void movesThatDoNotWin(GameState before, int column) {
        GameState after = Game.applyMove(before, column);

        assertEquals(GameStatus.IN_PROGRESS, after.status());
        assertEquals(List.of(), after.winningCells());
        assertEquals(before.currentPlayer().other(), after.currentPlayer());
    }

    static Stream<Arguments> everyWinningCellIsReturned() {
        return Stream.of(
                scenario("line of five", inProgress(
                        ".......",
                        ".......",
                        ".......",
                        ".......",
                        "YY.YY..",
                        "RR.RR.."), 2, "5,0 5,1 5,2 5,3 5,4"),
                scenario("line of seven", inProgress(
                        ".......",
                        ".......",
                        ".......",
                        ".......",
                        "YYY.YYY",
                        "RRR.RRR"), 3, "5,0 5,1 5,2 5,3 5,4 5,5 5,6"),
                scenario("falling diagonal of six", inProgress(
                        "R......",
                        "RR.....",
                        "RY.....",
                        "YYRR...",
                        "YYYRR..",
                        "YRYYYR."), 2, "0,0 1,1 2,2 3,3 4,4 5,5"),
                scenario("rising diagonal of five", inProgress(
                        ".......",
                        "....R..",
                        "...RY..",
                        "...YY..",
                        ".RYYR..",
                        "RRRYY.."), 2, "1,4 2,3 3,2 4,1 5,0"),
                scenario("horizontal and vertical at once", inProgress(
                        ".......",
                        "..Y....",
                        "RRR....",
                        "YYYR...",
                        "YYRR...",
                        "RYYR..."), 3, "2,0 2,1 2,2 2,3 3,3 4,3 5,3"),
                scenario("horizontal and diagonal at once", inProgress(
                        ".......",
                        ".......",
                        "RRR....",
                        "RYYYRR.",
                        "YYYRYR.",
                        "YYRYRYR"), 3, "2,0 2,1 2,2 2,3 3,4 4,5 5,6"));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource
    void everyWinningCellIsReturned(GameState before, int column, List<Position> expected) {
        assertRedWins(before, column, expected);
        assertEquals(expected.size(), Game.applyMove(before, column).winningCells().stream().distinct().count());
    }
}
