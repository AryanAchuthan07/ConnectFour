package com.example.connectfour.store;

import com.example.connectfour.game.GameState;
import com.example.connectfour.game.GameStatus;
import com.example.connectfour.game.Player;
import com.example.connectfour.game.Position;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;

/** All the SQL for games and moves. */
@Repository
public class GameStore {

    private static final String SELECT_GAME =
            "SELECT id, board, current_player, status, winning_cells, move_count FROM games WHERE id = :id";

    private final JdbcClient jdbc;
    private final JsonMapper json;

    GameStore(JdbcClient jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public StoredGame create(GameState state) {
        StoredGame game = new StoredGame(UUID.randomUUID(), state);
        bindState(jdbc.sql("""
                INSERT INTO games (id, board, current_player, status, winning_cells, move_count)
                VALUES (:id, :board, :currentPlayer, :status, CAST(:winningCells AS jsonb), :moveCount)
                """), game).update();
        return game;
    }

    public Optional<StoredGame> find(UUID id) {
        return jdbc.sql(SELECT_GAME)
                .param("id", id)
                .query((row, number) -> readGame(row))
                .optional();
    }

    /**
     * Like {@link #find}, but locks the game's row until the current transaction ends, so another
     * move for this game waits and then sees this one. Call it inside a transaction.
     */
    public Optional<StoredGame> findForUpdate(UUID id) {
        return jdbc.sql(SELECT_GAME + " FOR UPDATE")
                .param("id", id)
                .query((row, number) -> readGame(row))
                .optional();
    }

    public void update(StoredGame game) {
        int updated = bindState(jdbc.sql("""
                UPDATE games
                SET board = :board, current_player = :currentPlayer, status = :status,
                    winning_cells = CAST(:winningCells AS jsonb), move_count = :moveCount, updated_at = now()
                WHERE id = :id
                """), game).update();
        if (updated != 1) {
            throw new IllegalStateException("No game to update with ID " + game.id());
        }
    }

    public void recordMove(UUID gameId, int moveNumber, Player player, int column) {
        jdbc.sql("""
                INSERT INTO moves (game_id, move_number, player, col)
                VALUES (:gameId, :moveNumber, :player, :column)
                """)
                .param("gameId", gameId)
                .param("moveNumber", moveNumber)
                .param("player", code(player))
                .param("column", column)
                .update();
    }

    private JdbcClient.StatementSpec bindState(JdbcClient.StatementSpec statement, StoredGame game) {
        GameState state = game.state();
        return statement
                .param("id", game.id())
                .param("board", BoardCodec.encode(state.board()))
                .param("currentPlayer", code(state.currentPlayer()))
                .param("status", state.status().name().toLowerCase(Locale.ROOT))
                .param("winningCells", writeCells(state.winningCells()), java.sql.Types.VARCHAR)
                .param("moveCount", state.moveCount());
    }

    private StoredGame readGame(ResultSet row) throws SQLException {
        GameState state = new GameState(
                BoardCodec.decode(row.getString("board")),
                row.getString("current_player").equals("R") ? Player.RED : Player.YELLOW,
                GameStatus.valueOf(row.getString("status").toUpperCase(Locale.ROOT)),
                readCells(row.getString("winning_cells")),
                row.getInt("move_count"));
        return new StoredGame(row.getObject("id", UUID.class), state);
    }

    private static String code(Player player) {
        return player == Player.RED ? "R" : "Y";
    }

    private String writeCells(List<Position> cells) {
        if (cells.isEmpty()) {
            return null;
        }
        return json.writeValueAsString(cells.stream()
                .map(cell -> new int[] {cell.row(), cell.col()})
                .toList());
    }

    private List<Position> readCells(String text) {
        if (text == null) {
            return List.of();
        }
        return Arrays.stream(json.readValue(text, int[][].class))
                .map(cell -> new Position(cell[0], cell[1]))
                .toList();
    }
}
