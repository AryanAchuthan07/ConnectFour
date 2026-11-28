package com.example.connectfour.api;

class ApiException extends RuntimeException {

    final ApiError error;

    ApiException(ApiError error) {
        super(error.name());
        this.error = error;
    }
}
