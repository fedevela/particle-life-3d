import { SqliteQueryExecutor } from "./sqlite-query-executor";

export function ensureSqliteSchema(executor: SqliteQueryExecutor) {
  executor.execute(
    "CREATE TABLE IF NOT EXISTS variables (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, value TEXT NOT NULL, UNIQUE(project_id, name))",
  );
  executor.execute(
    "CREATE TABLE IF NOT EXISTS sprites (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, type TEXT NOT NULL, pos_x REAL NOT NULL, pos_y REAL NOT NULL, pos_z REAL NOT NULL, metadata TEXT NOT NULL)",
  );
  executor.execute(
    "CREATE TABLE IF NOT EXISTS simulation_snapshots (project_id TEXT NOT NULL, milestone_id TEXT NOT NULL, frame INTEGER NOT NULL, payload_x REAL NOT NULL, payload_y REAL NOT NULL, payload_z REAL NOT NULL, UNIQUE(project_id, milestone_id))",
  );

  migrateLegacySpritesProjectScope(executor);
  migrateLegacyVariablesProjectScope(executor);
  executor.execute("CREATE INDEX IF NOT EXISTS idx_sprites_project_id ON sprites(project_id)");
  executor.execute("CREATE INDEX IF NOT EXISTS idx_variables_project_id ON variables(project_id)");
  executor.execute(
    "CREATE INDEX IF NOT EXISTS idx_simulation_snapshots_project_frame ON simulation_snapshots(project_id, frame, milestone_id)",
  );
}

/** Add project_id to sprites for legacy databases created before project scoping. */
function migrateLegacySpritesProjectScope(executor: SqliteQueryExecutor) {
  const columns = executor.selectAll("PRAGMA table_info(sprites)");
  const hasProjectId = columns.some((column) => executor.toStringValue(column.name, "sprites column") === "project_id");

  if (!hasProjectId) {
    executor.execute("ALTER TABLE sprites ADD COLUMN project_id TEXT NOT NULL DEFAULT 'default'");
  }
}

/** Migrate variables table to project-scoped uniqueness for legacy databases. */
function migrateLegacyVariablesProjectScope(executor: SqliteQueryExecutor) {
  const columns = executor.selectAll("PRAGMA table_info(variables)");
  const hasProjectId = columns.some(
    (column) => executor.toStringValue(column.name, "variables column") === "project_id",
  );

  if (hasProjectId) {
    return;
  }

  executor.execute("ALTER TABLE variables RENAME TO variables_legacy");
  executor.execute(
    "CREATE TABLE variables (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, value TEXT NOT NULL, UNIQUE(project_id, name))",
  );
  executor.execute(
    "INSERT INTO variables (id, project_id, name, value) SELECT id, 'default', name, value FROM variables_legacy",
  );
  executor.execute("DROP TABLE variables_legacy");
}
