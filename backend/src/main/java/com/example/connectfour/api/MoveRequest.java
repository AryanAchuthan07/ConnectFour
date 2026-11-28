package com.example.connectfour.api;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

record MoveRequest(int column, int moveCount) {

    /**
     * Reads the JSON by hand because automatic binding can turn "3" or 3.5 into 3. Both fields must
     * be JSON integers.
     */
    static MoveRequest parse(byte[] body, JsonMapper json) {
        JsonNode root;
        try {
            root = json.readTree(body);
        } catch (JacksonException e) {
            throw new ApiException(ApiError.INVALID_REQUEST);
        }
        return new MoveRequest(integer(root, "column"), integer(root, "moveCount"));
    }

    private static int integer(JsonNode root, String field) {
        JsonNode value = root.get(field);
        if (value == null || !value.isIntegralNumber() || !value.canConvertToInt()) {
            throw new ApiException(ApiError.INVALID_REQUEST);
        }
        return value.intValue();
    }
}
