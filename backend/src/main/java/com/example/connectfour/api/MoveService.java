package com.example.connectfour.api;

import com.example.connectfour.game.Game;
import com.example.connectfour.game.GameState;
import com.example.connectfour.store.GameStore;
import com.example.connectfour.store.StoredGame;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class MoveService {

    private final GameStore store;

    MoveService(GameStore store) {
        this.store = store;
    }

    /** Loads, checks and saves one move. Any failure rolls the whole move back. */
    @Transactional
    StoredGame play(UUID gameId, int column, int moveCount) {
        StoredGame game = store.findForUpdate(gameId)
                .orElseThrow(() -> new ApiException(ApiError.GAME_NOT_FOUND));
        GameState before = game.state();
        if (moveCount != before.moveCount()) {
            throw new ApiException(ApiError.STALE_MOVE);
        }

        StoredGame after = new StoredGame(gameId, Game.applyMove(before, column));
        store.recordMove(gameId, after.state().moveCount(), before.currentPlayer(), column);
        store.update(after);
        return after;
    }
}
