package com.example.connectfour.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class GameStateTest {

    @Test
    void winningCellsCannotBeChangedAfterwards() {
        List<Position> source = new ArrayList<>(List.of(new Position(5, 0)));
        GameState state = new GameState(Board.empty(), Player.RED, GameStatus.RED_WON, source, 7);

        source.add(new Position(5, 1));

        assertEquals(List.of(new Position(5, 0)), state.winningCells());
        assertThrows(UnsupportedOperationException.class,
                () -> state.winningCells().add(new Position(5, 2)));
    }
}
