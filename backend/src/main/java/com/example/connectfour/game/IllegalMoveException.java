package com.example.connectfour.game;

public class IllegalMoveException extends RuntimeException {

    private final MoveError error;

    public IllegalMoveException(MoveError error) {
        super(error.name());
        this.error = error;
    }

    public MoveError error() {
        return error;
    }
}
