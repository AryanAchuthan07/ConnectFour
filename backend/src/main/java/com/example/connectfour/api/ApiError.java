package com.example.connectfour.api;

import org.springframework.http.HttpStatus;

/** Every error the API can return. The frontend shows the message as it is. */
enum ApiError {
    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "That request wasn't valid."),
    GAME_NOT_FOUND(HttpStatus.NOT_FOUND, "We couldn't find that game."),
    STALE_MOVE(HttpStatus.CONFLICT, "The game has changed. Check the board and try again."),
    GAME_OVER(HttpStatus.CONFLICT, "This game is already over."),
    INVALID_COLUMN(HttpStatus.BAD_REQUEST, "That column doesn't exist."),
    COLUMN_FULL(HttpStatus.CONFLICT, "That column is full."),
    // Not about a game: a request outside the API, or something unexpected.
    NOT_FOUND(HttpStatus.NOT_FOUND, "We couldn't find that."),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "That action isn't allowed."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong. Please try again.");

    final HttpStatus status;
    final String message;

    ApiError(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }
}
