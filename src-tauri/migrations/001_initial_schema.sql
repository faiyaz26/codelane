-- Initial database schema for Codelane
-- Version: 001
-- Description: Core tables for lanes, configs, and settings

-- ============================================================================
-- SETTINGS TABLE
-- ============================================================================
-- Key-value store for application settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
    ('app_version', '0.1.0', strftime('%s', 'now')),
    ('db_version', '1', strftime('%s', 'now'));

-- ============================================================================
-- LANES TABLE
-- ============================================================================
-- Main lanes (project workspaces) table
CREATE TABLE IF NOT EXISTS lanes (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    working_dir TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_accessed INTEGER,
    is_favorite INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0
);

-- ============================================================================
-- LANE CONFIGURATIONS
-- ============================================================================
-- Per-lane configuration (agent settings, env vars, etc.)
CREATE TABLE IF NOT EXISTS lane_configs (
    lane_id TEXT PRIMARY KEY NOT NULL,
    agent_override TEXT,      -- JSON: AgentConfig
    env TEXT,                 -- JSON: environment variables array
    lsp_servers TEXT,         -- JSON: LSP server names array
    FOREIGN KEY (lane_id) REFERENCES lanes(id) ON DELETE CASCADE
);

-- ============================================================================
-- LANE METADATA
-- ============================================================================
-- Additional metadata for lanes (tags, notes, etc.)
CREATE TABLE IF NOT EXISTS lane_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lane_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE(lane_id, key),
    FOREIGN KEY (lane_id) REFERENCES lanes(id) ON DELETE CASCADE
);

-- ============================================================================
-- TAGS (for future use)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lane_tags (
    lane_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (lane_id, tag_id),
    FOREIGN KEY (lane_id) REFERENCES lanes(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_lanes_updated_at ON lanes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lanes_name ON lanes(name);
CREATE INDEX IF NOT EXISTS idx_lanes_last_accessed ON lanes(last_accessed DESC);
CREATE INDEX IF NOT EXISTS idx_lanes_favorite ON lanes(is_favorite, last_accessed DESC);

CREATE INDEX IF NOT EXISTS idx_lane_metadata_lane_id ON lane_metadata(lane_id);
CREATE INDEX IF NOT EXISTS idx_lane_metadata_key ON lane_metadata(key);

CREATE INDEX IF NOT EXISTS idx_lane_tags_lane_id ON lane_tags(lane_id);
CREATE INDEX IF NOT EXISTS idx_lane_tags_tag_id ON lane_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
