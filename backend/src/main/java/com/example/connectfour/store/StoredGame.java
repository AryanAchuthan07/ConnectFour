package com.example.connectfour.store;

import com.example.connectfour.game.GameState;
import java.util.UUID;

public record StoredGame(UUID id, GameState state) {
}
