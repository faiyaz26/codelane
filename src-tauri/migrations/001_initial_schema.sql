-- Initial database schema for Codelane

-- Lanes table
CREATE TABLE IF NOT EXISTS lanes (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    working_dir TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Lane configuration (separate table for flexibility)
CREATE TABLE IF NOT EXISTS lane_configs (
    lane_id TEXT PRIMARY KEY NOT NULL,
    agent_override TEXT,  -- JSON serialized AgentConfig
    env TEXT,             -- JSON serialized environment variables
    lsp_servers TEXT,     -- JSON array of LSP servers
    FOREIGN KEY (lane_id) REFERENCES lanes(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_lanes_updated_at ON lanes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lanes_name ON lanes(name);
