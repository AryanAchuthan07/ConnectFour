package com.example.connectfour.api;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class HealthController {

    private static final Logger log = LoggerFactory.getLogger(HealthController.class);
    private static final Map<String, String> OK = Map.of("status", "ok");

    private final JdbcClient jdbc;

    HealthController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Liveness and startup. Must not touch the database: a restart can't fix Postgres. */
    @GetMapping("/livez")
    Map<String, String> livez() {
        return OK;
    }

    /** Readiness: this pod should only get traffic while it can reach Postgres. */
    @GetMapping("/healthz")
    ResponseEntity<Map<String, String>> healthz() {
        try {
            jdbc.sql("SELECT 1").query(Integer.class).single();
            return ResponseEntity.ok(OK);
        } catch (DataAccessException e) {
            log.warn("Health check could not reach Postgres: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("status", "unavailable"));
        }
    }
}
