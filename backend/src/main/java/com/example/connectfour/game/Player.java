package com.example.connectfour.game;

public enum Player {
    RED,
    YELLOW;

    public Cell cell() {
        return this == RED ? Cell.RED : Cell.YELLOW;
    }

    public Player other() {
        return this == RED ? YELLOW : RED;
    }
}
