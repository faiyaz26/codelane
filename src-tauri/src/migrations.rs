//! Database migrations system

use std::fs;
use std::path::PathBuf;

/// Migration metadata
#[derive(Debug)]
pub struct Migration {
    pub version: i32,
    pub name: String,
    pub sql: String,
}

/// Get all migration files from the migrations directory
pub fn get_migrations() -> Result<Vec<Migration>, Box<dyn std::error::Error>> {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let migrations_dir = PathBuf::from(manifest_dir).join("migrations");

    let mut migrations = Vec::new();

    for entry in fs::read_dir(migrations_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("sql") {
            let filename = path.file_stem()
                .and_then(|s| s.to_str())
                .ok_or("Invalid filename")?;

            // Parse version from filename (e.g., "001_initial_schema.sql" -> 1)
            let parts: Vec<&str> = filename.split('_').collect();
            if let Some(version_str) = parts.first() {
                if let Ok(version) = version_str.parse::<i32>() {
                    let name = parts[1..].join("_");
                    let sql = fs::read_to_string(&path)?;

                    migrations.push(Migration {
                        version,
                        name,
                        sql,
                    });
                }
            }
        }
    }

    // Sort by version
    migrations.sort_by_key(|m| m.version);

    Ok(migrations)
}

/// Get the SQL for all migrations as a single string
pub fn get_all_migrations_sql() -> String {
    let migrations = match get_migrations() {
        Ok(m) => m,
        Err(e) => {
            tracing::error!("Failed to load migrations: {}", e);
            return String::new();
        }
    };

    let mut sql = String::new();

    // Add migration tracking table
    sql.push_str(include_str!("../migrations/000_migrations_table.sql"));
    sql.push_str("\n\n");

    // Add all migrations
    for migration in migrations {
        sql.push_str(&format!("-- Migration {}: {}\n", migration.version, migration.name));
        sql.push_str(&migration.sql);
        sql.push_str("\n\n");

        // Record migration
        sql.push_str(&format!(
            "INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES ({}, '{}', strftime('%s', 'now'));\n\n",
            migration.version, migration.name
        ));
    }

    sql
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_migrations() {
        let migrations = get_migrations().unwrap();
        assert!(!migrations.is_empty());
        println!("Found {} migrations", migrations.len());
        for m in migrations {
            println!("  v{}: {}", m.version, m.name);
        }
    }
}
