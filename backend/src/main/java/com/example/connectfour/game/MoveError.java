package com.example.connectfour.game;

/** Why the rules rejected a move. */
public enum MoveError {
    GAME_OVER,
    INVALID_COLUMN,
    COLUMN_FULL
}
