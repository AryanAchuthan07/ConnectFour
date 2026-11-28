package com.example.connectfour.api;

import com.example.connectfour.game.IllegalMoveException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Gives every failure the same error shape. */
@RestControllerAdvice
class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler
    ResponseEntity<ErrorResponse> handle(ApiException e) {
        return respond(e.error);
    }

    @ExceptionHandler
    ResponseEntity<ErrorResponse> handle(IllegalMoveException e) {
        return respond(switch (e.error()) {
            case GAME_OVER -> ApiError.GAME_OVER;
            case INVALID_COLUMN -> ApiError.INVALID_COLUMN;
            case COLUMN_FULL -> ApiError.COLUMN_FULL;
        });
    }

    @ExceptionHandler
    ResponseEntity<ErrorResponse> handle(NoResourceFoundException e) {
        return respond(ApiError.NOT_FOUND);
    }

    @ExceptionHandler
    ResponseEntity<ErrorResponse> handle(HttpRequestMethodNotSupportedException e) {
        // Spring's headers include Allow, which lists the methods that do work.
        return respond(ApiError.METHOD_NOT_ALLOWED, ApiError.METHOD_NOT_ALLOWED.status, e.getHeaders());
    }

    @ExceptionHandler
    ResponseEntity<ErrorResponse> handle(Exception e) {
        // Spring marks the caller's mistakes with a 4xx status. Those aren't server failures.
        if (e instanceof org.springframework.web.ErrorResponse known && known.getStatusCode().is4xxClientError()) {
            return respond(ApiError.INVALID_REQUEST, known.getStatusCode(), known.getHeaders());
        }
        // The details go to the log only, never to the caller.
        log.error("Unexpected error", e);
        return respond(ApiError.INTERNAL_ERROR);
    }

    private static ResponseEntity<ErrorResponse> respond(ApiError error) {
        return respond(error, error.status, HttpHeaders.EMPTY);
    }

    private static ResponseEntity<ErrorResponse> respond(ApiError error, HttpStatusCode status, HttpHeaders headers) {
        return ResponseEntity.status(status)
                .headers(headers)
                .contentType(MediaType.APPLICATION_JSON)
                .body(ErrorResponse.of(error));
    }
}
