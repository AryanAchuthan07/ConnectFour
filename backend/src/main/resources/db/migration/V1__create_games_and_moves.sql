-- The CHECK constraints are a backstop. The game rules in the `game` package are what decide moves.

CREATE TABLE games (
    id             UUID        PRIMARY KEY,
    -- One character per cell, row by row from the top.
    board          TEXT        NOT NULL CHECK (board ~ '^[.RY]{42}$'),
    current_player TEXT        NOT NULL CHECK (current_player IN ('R', 'Y')),
    status         TEXT        NOT NULL CHECK (status IN ('in_progress', 'red_won', 'yellow_won', 'draw')),
    -- [[row, col], ...], or NULL unless someone has won.
    winning_cells  JSONB,
    move_count     INT         NOT NULL CHECK (move_count BETWEEN 0 AND 42),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE moves (
    game_id     UUID        NOT NULL REFERENCES games (id),
    move_number INT         NOT NULL CHECK (move_number BETWEEN 1 AND 42),
    player      TEXT        NOT NULL CHECK (player IN ('R', 'Y')),
    col         INT         NOT NULL CHECK (col BETWEEN 0 AND 6),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Two moves can never take the same turn.
    UNIQUE (game_id, move_number)
);
