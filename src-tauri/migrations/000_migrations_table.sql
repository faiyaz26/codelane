-- Schema migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL
);
