package com.example.connectfour.api;

record ErrorResponse(Detail error) {

    record Detail(String code, String message) {
    }

    static ErrorResponse of(ApiError error) {
        return new ErrorResponse(new Detail(error.name(), error.message));
    }
}
