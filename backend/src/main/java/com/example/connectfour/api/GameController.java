package com.example.connectfour.api;

import com.example.connectfour.game.Game;
import com.example.connectfour.store.GameStore;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping("/api/games")
class GameController {

    // UUID.fromString alone also accepts shortened forms such as 1-1-1-1-1.
    private static final Pattern UUID_FORMAT =
            Pattern.compile("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");

    private final GameStore store;
    private final MoveService moves;
    private final JsonMapper json;

    GameController(GameStore store, MoveService moves, JsonMapper json) {
        this.store = store;
        this.moves = moves;
        this.json = json;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    GameResponse create() {
        return GameResponse.from(store.create(Game.newGame()));
    }

    @GetMapping("/{id}")
    GameResponse get(@PathVariable String id) {
        return store.find(parseId(id))
                .map(GameResponse::from)
                .orElseThrow(() -> new ApiException(ApiError.GAME_NOT_FOUND));
    }

    // The body is read straight from the request. Binding it with @RequestBody would let Spring
    // rewrite a body labelled as form data (what `curl -d` sends), or reject other content types.
    @PostMapping("/{id}/moves")
    GameResponse move(@PathVariable String id, HttpServletRequest request) throws IOException {
        UUID gameId = parseId(id);
        MoveRequest move = MoveRequest.parse(request.getInputStream().readAllBytes(), json);
        return GameResponse.from(moves.play(gameId, move.column(), move.moveCount()));
    }

    private static UUID parseId(String id) {
        if (!UUID_FORMAT.matcher(id).matches()) {
            throw new ApiException(ApiError.INVALID_REQUEST);
        }
        return UUID.fromString(id);
    }
}
