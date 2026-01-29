/**
 * Database initialization and utilities
 */

import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';

let dbInstance: Database | null = null;

/**
 * Initialize the database and run migrations
 */
export async function initDatabase(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    // Get database path from backend
    const dbPath = await invoke<string>('db_get_path');
    console.log('Initializing database:', dbPath);

    // Load database
    const db = await Database.load(dbPath);

    // Manually run migrations (simple version-based system)
    // Migration 000: Schema migrations tracking
    await db.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          applied_at INTEGER NOT NULL
      );
    `);

    // Check if migration 001 has been applied
    const result = await db.select<Array<{version: number}>>(
      'SELECT version FROM schema_migrations WHERE version = 1'
    );

    if (result.length === 0) {
      console.log('Running migration 001: initial schema with JSON columns');

      // Migration 001: Initial schema with JSON columns
      await db.execute(`
        -- Settings table (key-value store)
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );

        INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
            ('app_version', '0.1.0', strftime('%s', 'now')),
            ('db_version', '1', strftime('%s', 'now'));

        -- Lanes table with JSON config
        CREATE TABLE IF NOT EXISTS lanes (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            working_dir TEXT NOT NULL,
            config TEXT NOT NULL DEFAULT '{}',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            last_accessed INTEGER,
            is_favorite INTEGER DEFAULT 0,
            sort_order INTEGER DEFAULT 0
        );

        -- Tags for organizing lanes
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

        -- Standard indexes
        CREATE INDEX IF NOT EXISTS idx_lanes_updated_at ON lanes(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_lanes_name ON lanes(name);
        CREATE INDEX IF NOT EXISTS idx_lanes_last_accessed ON lanes(last_accessed DESC);
        CREATE INDEX IF NOT EXISTS idx_lanes_favorite ON lanes(is_favorite DESC, last_accessed DESC);

        -- JSON field indexes
        CREATE INDEX IF NOT EXISTS idx_lanes_has_agent_override ON lanes(
            (json_extract(config, '$.agentOverride') IS NOT NULL)
        );

        CREATE INDEX IF NOT EXISTS idx_lanes_agent_type ON lanes(
            json_extract(config, '$.agentOverride.agentType')
        ) WHERE json_extract(config, '$.agentOverride') IS NOT NULL;

        -- Tag indexes
        CREATE INDEX IF NOT EXISTS idx_lane_tags_lane_id ON lane_tags(lane_id);
        CREATE INDEX IF NOT EXISTS idx_lane_tags_tag_id ON lane_tags(tag_id);
      `);

      // Record migration
      await db.execute(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [1, 'initial_schema_json', Math.floor(Date.now() / 1000)]
      );

      console.log('Migration 001 applied successfully');
    } else {
      console.log('Database already up to date');
    }

    console.log('Database initialized successfully');
    dbInstance = db;
    return db;
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

/**
 * Get the database instance
 */
export async function getDatabase(): Promise<Database> {
  if (!dbInstance) {
    return await initDatabase();
  }
  return dbInstance;
}
