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

  // Get database path from backend
  const dbPath = await invoke<string>('db_get_path');
  console.log('Initializing database:', dbPath);

  // Load database
  const db = await Database.load(dbPath);

  // Run initial schema migration
  await db.execute(`
    -- Lanes table
    CREATE TABLE IF NOT EXISTS lanes (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        working_dir TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );

    -- Lane configuration
    CREATE TABLE IF NOT EXISTS lane_configs (
        lane_id TEXT PRIMARY KEY NOT NULL,
        agent_override TEXT,
        env TEXT,
        lsp_servers TEXT,
        FOREIGN KEY (lane_id) REFERENCES lanes(id) ON DELETE CASCADE
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_lanes_updated_at ON lanes(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_lanes_name ON lanes(name);
  `);

  console.log('Database initialized successfully');
  dbInstance = db;
  return db;
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
