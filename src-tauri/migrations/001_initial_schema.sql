-- Initial database schema for Codelane
-- Version: 001
-- Description: Core tables with JSON columns for flexibility

-- ============================================================================
-- SETTINGS TABLE (Key-Value Store)
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,        -- JSON or plain text value
    updated_at INTEGER NOT NULL
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
    ('app_version', '0.1.0', strftime('%s', 'now')),
    ('db_version', '1', strftime('%s', 'now'));

-- ============================================================================
-- LANES TABLE (with embedded JSON config)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lanes (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    working_dir TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',  -- JSON: LaneConfig {agentOverride?, env[], lspServers[]}
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_accessed INTEGER,
    is_favorite INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0
);

-- ============================================================================
-- TAGS (for future organizing lanes)
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
-- Standard indexes
CREATE INDEX IF NOT EXISTS idx_lanes_updated_at ON lanes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lanes_name ON lanes(name);
CREATE INDEX IF NOT EXISTS idx_lanes_last_accessed ON lanes(last_accessed DESC);
CREATE INDEX IF NOT EXISTS idx_lanes_favorite ON lanes(is_favorite DESC, last_accessed DESC);

-- JSON field indexes (query into config)
CREATE INDEX IF NOT EXISTS idx_lanes_has_agent_override ON lanes(
    (json_extract(config, '$.agentOverride') IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_lanes_agent_type ON lanes(
    json_extract(config, '$.agentOverride.agentType')
) WHERE json_extract(config, '$.agentOverride') IS NOT NULL;

-- Tag indexes
CREATE INDEX IF NOT EXISTS idx_lane_tags_lane_id ON lane_tags(lane_id);
CREATE INDEX IF NOT EXISTS idx_lane_tags_tag_id ON lane_tags(tag_id);
