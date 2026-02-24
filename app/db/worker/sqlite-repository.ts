import type { ContractScope } from "~/db/worker/messages";
import type { SpriteRecord, VariableRecord } from "~/db/types";

/** Represent one sqlite row mapped as an object with unknown scalar values. */
type SqliteObjectRow = Record<string, unknown>;

/** Define the deterministic row shape used by contract exports for sprites. */
type ContractSpriteRow = {
  type: string;
  x: string;
  y: string;
  z: string;
  metadata: string;
};

/** Define the deterministic row shape used by contract exports for variables. */
type ContractVariableRow = {
  name: string;
  value: string;
};

/** Define the minimal sqlite-wasm DB interface consumed by the repository wrapper. */
export type SqliteDatabase = {
  exec: (args: {
    sql: string;
    bind?: unknown[];
    rowMode?: "object" | "array";
    callback?: (row: SqliteObjectRow | unknown[]) => void;
  }) => void;
};

/** Return a normalized project ID or throw when invalid. */
function normalizeProjectId(projectId: string) {
  const normalized = projectId.trim();
  if (normalized.length === 0) {
    throw new Error("Expected projectId to be a non-empty string.");
  }

  return normalized;
}

/** Format a finite number into deterministic six-decimal text. */
function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error(`Expected finite numeric value, received ${String(value)}.`);
  }

  const formatted = value.toFixed(6);
  return formatted === "-0.000000" ? "0.000000" : formatted;
}

/** Canonicalize JSON object key order recursively while preserving array order. */
function sortJsonKeysRecursively(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonKeysRecursively(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const sortedEntries = Object.keys(record)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => [key, sortJsonKeysRecursively(record[key])] as const);

  return Object.fromEntries(sortedEntries);
}

/** Return compact canonical JSON text when parseable; otherwise return the original text. */
function canonicalizeJsonOrRaw(input: string) {
  try {
    const parsed = JSON.parse(input) as unknown;
    const sorted = sortJsonKeysRecursively(parsed);
    return JSON.stringify(sorted);
  } catch {
    return input;
  }
}

/** Escape DB contract fields so separators and line-breaks remain deterministic. */
function escapeField(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("|", "\\|").replaceAll("\n", "\\n");
}

/**
 * Encapsulate typed SQLite reads/writes performed in the worker.
 *
 * This class centralizes schema management and row-to-domain mapping.
 */
export class SqliteRepository {
  /** Store the concrete sqlite-wasm database adapter. */
  private readonly db: SqliteDatabase;

  /** Initialize repository with a sqlite database adapter. */
  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  /** Ensure required tables exist before any query is executed. */
  public ensureSchema() {
    this.execute(
      "CREATE TABLE IF NOT EXISTS variables (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, value TEXT NOT NULL, UNIQUE(project_id, name))",
    );
    this.execute(
      "CREATE TABLE IF NOT EXISTS sprites (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, type TEXT NOT NULL, pos_x REAL NOT NULL, pos_y REAL NOT NULL, pos_z REAL NOT NULL, metadata TEXT NOT NULL)",
    );

    this.migrateLegacySpritesProjectScope();
    this.migrateLegacyVariablesProjectScope();
    this.execute("CREATE INDEX IF NOT EXISTS idx_sprites_project_rowid ON sprites(project_id, rowid)");
    this.execute(
      "CREATE INDEX IF NOT EXISTS idx_variables_project_rowid ON variables(project_id, rowid)",
    );
  }

  /** Read the number of persisted sprites for one project. */
  public readSpriteCount(projectId: string) {
    const normalizedProjectId = normalizeProjectId(projectId);
    const row = this.selectFirst("SELECT COUNT(*) AS count FROM sprites WHERE project_id = ?", [
      normalizedProjectId,
    ]);
    if (row === null) {
      return 0;
    }

    const countValue = Object.values(row)[0];
    const parsedCount = Number(countValue);
    if (!Number.isFinite(parsedCount)) {
      throw new Error(`Expected finite sprite count, received ${String(countValue)}.`);
    }

    return parsedCount;
  }

  /** Insert a new sprite row for one project. */
  public insertSprite(record: SpriteRecord, projectId: string) {
    const normalizedProjectId = normalizeProjectId(projectId);

    this.execute(
      "INSERT INTO sprites (id, project_id, type, pos_x, pos_y, pos_z, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        record.id,
        normalizedProjectId,
        record.type,
        record.pos_x,
        record.pos_y,
        record.pos_z,
        record.metadata,
      ],
    );
  }

  /** Update an existing sprite row by ID and project ID. */
  public updateSprite(record: SpriteRecord, projectId: string) {
    const normalizedProjectId = normalizeProjectId(projectId);

    this.execute(
      "UPDATE sprites SET type = ?, pos_x = ?, pos_y = ?, pos_z = ?, metadata = ? WHERE id = ? AND project_id = ?",
      [record.type, record.pos_x, record.pos_y, record.pos_z, record.metadata, record.id, normalizedProjectId],
    );
  }

  /** Find a sprite row by ID in one project. */
  public findSpriteId(id: string, projectId: string): string | null {
    const normalizedProjectId = normalizeProjectId(projectId);
    const row = this.selectFirst("SELECT id FROM sprites WHERE id = ? AND project_id = ? LIMIT 1", [
      id,
      normalizedProjectId,
    ]);
    if (row === null) {
      return null;
    }

    return this.toStringValue(row.id, "sprites.id");
  }

  /** Fetch all sprite rows for one project in insertion order. */
  public fetchSprites(projectId: string): SpriteRecord[] {
    const normalizedProjectId = normalizeProjectId(projectId);
    const rows = this.selectAll(
      "SELECT id, type, pos_x, pos_y, pos_z, metadata FROM sprites WHERE project_id = ? ORDER BY rowid ASC",
      [normalizedProjectId],
    );

    return rows.map((row, index) => this.toSpriteRecord(row, index));
  }

  /** Find a variable row by name in one project. */
  public findVariableByName(name: string, projectId: string): VariableRecord | null {
    const normalizedProjectId = normalizeProjectId(projectId);
    const row = this.selectFirst(
      "SELECT id, name, value FROM variables WHERE project_id = ? AND name = ? LIMIT 1",
      [normalizedProjectId, name],
    );
    if (row === null) {
      return null;
    }

    return {
      id: this.toStringValue(row.id, "variables.id"),
      name: this.toStringValue(row.name, "variables.name"),
      value: this.toStringValue(row.value, "variables.value"),
    };
  }

  /** Insert a new variable row for one project. */
  public insertVariable(record: VariableRecord, projectId: string) {
    const normalizedProjectId = normalizeProjectId(projectId);

    this.execute("INSERT INTO variables (id, project_id, name, value) VALUES (?, ?, ?, ?)", [
      record.id,
      normalizedProjectId,
      record.name,
      record.value,
    ]);
  }

  /** Update a variable value by stable ID/name in one project. */
  public updateVariableValue(record: VariableRecord, projectId: string) {
    const normalizedProjectId = normalizeProjectId(projectId);

    this.execute("UPDATE variables SET value = ? WHERE id = ? AND project_id = ? AND name = ?", [
      record.value,
      record.id,
      normalizedProjectId,
      record.name,
    ]);
  }

  /** Delete all persisted data for one project. */
  public deleteProjectData(projectId: string) {
    const normalizedProjectId = normalizeProjectId(projectId);

    this.execute("DELETE FROM sprites WHERE project_id = ?", [normalizedProjectId]);
    this.execute("DELETE FROM variables WHERE project_id = ?", [normalizedProjectId]);
  }

  /** Return deterministic text contract for one project and selected scope. */
  public getProjectContractText(projectId: string, scope: ContractScope = "all") {
    const normalizedProjectId = normalizeProjectId(projectId);

    const spriteSection = this.formatSpriteSection(normalizedProjectId);
    const variableSection = this.formatVariableSection(normalizedProjectId);

    if (scope === "sprites") {
      return spriteSection;
    }

    if (scope === "variables") {
      return variableSection;
    }

    return `${spriteSection}\n\n${variableSection}`;
  }

  /** Format deterministic sprite contract section for one project. */
  private formatSpriteSection(projectId: string) {
    const rows = this.selectAll(
      "SELECT type, pos_x, pos_y, pos_z, metadata FROM sprites WHERE project_id = ?",
      [projectId],
    );

    const projected = rows
      .map<ContractSpriteRow>((row, index) => ({
        type: escapeField(this.toStringValue(row.type, `sprites[${index}].type`)),
        x: formatNumber(this.toFiniteNumber(row.pos_x, `sprites[${index}].pos_x`)),
        y: formatNumber(this.toFiniteNumber(row.pos_y, `sprites[${index}].pos_y`)),
        z: formatNumber(this.toFiniteNumber(row.pos_z, `sprites[${index}].pos_z`)),
        metadata: escapeField(
          canonicalizeJsonOrRaw(this.toStringValue(row.metadata, `sprites[${index}].metadata`)),
        ),
      }))
      .sort((left, right) => {
        const leftTuple = [left.type, left.x, left.y, left.z, left.metadata];
        const rightTuple = [right.type, right.x, right.y, right.z, right.metadata];

        for (let tupleIndex = 0; tupleIndex < leftTuple.length; tupleIndex += 1) {
          const comparison = leftTuple[tupleIndex].localeCompare(rightTuple[tupleIndex]);
          if (comparison !== 0) {
            return comparison;
          }
        }

        return 0;
      });

    const lines = [`[sprites]`, `count=${projected.length}`];

    for (let index = 0; index < projected.length; index += 1) {
      const next = projected[index];
      lines.push(`${index}|${next.type}|${next.x}|${next.y}|${next.z}|${next.metadata}`);
    }

    return lines.join("\n");
  }

  /** Format deterministic variable contract section for one project. */
  private formatVariableSection(projectId: string) {
    const rows = this.selectAll("SELECT name, value FROM variables WHERE project_id = ?", [projectId]);

    const projected = rows
      .map<ContractVariableRow>((row, index) => ({
        name: escapeField(this.toStringValue(row.name, `variables[${index}].name`)),
        value: escapeField(
          canonicalizeJsonOrRaw(this.toStringValue(row.value, `variables[${index}].value`)),
        ),
      }))
      .sort((left, right) => {
        const nameComparison = left.name.localeCompare(right.name);
        if (nameComparison !== 0) {
          return nameComparison;
        }

        return left.value.localeCompare(right.value);
      });

    const lines = [`[variables]`, `count=${projected.length}`];

    for (let index = 0; index < projected.length; index += 1) {
      const next = projected[index];
      lines.push(`${index}|${next.name}|${next.value}`);
    }

    return lines.join("\n");
  }

  /** Add project_id to sprites for legacy databases created before project scoping. */
  private migrateLegacySpritesProjectScope() {
    const columns = this.selectAll("PRAGMA table_info(sprites)");
    const hasProjectId = columns.some((column) => this.toStringValue(column.name, "sprites column") === "project_id");

    if (!hasProjectId) {
      this.execute("ALTER TABLE sprites ADD COLUMN project_id TEXT NOT NULL DEFAULT 'default'");
    }
  }

  /** Migrate variables table to project-scoped uniqueness for legacy databases. */
  private migrateLegacyVariablesProjectScope() {
    const columns = this.selectAll("PRAGMA table_info(variables)");
    const hasProjectId = columns.some(
      (column) => this.toStringValue(column.name, "variables column") === "project_id",
    );

    if (hasProjectId) {
      return;
    }

    this.execute("ALTER TABLE variables RENAME TO variables_legacy");
    this.execute(
      "CREATE TABLE variables (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, value TEXT NOT NULL, UNIQUE(project_id, name))",
    );
    this.execute(
      "INSERT INTO variables (id, project_id, name, value) SELECT id, 'default', name, value FROM variables_legacy",
    );
    this.execute("DROP TABLE variables_legacy");
  }

  /** Execute a SQL statement with optional bound parameters. */
  private execute(sql: string, bind: unknown[] = []) {
    this.db.exec({
      sql,
      bind,
    });
  }

  /** Execute a SQL query and return all rows as object records. */
  private selectAll(sql: string, bind: unknown[] = []) {
    const rows: SqliteObjectRow[] = [];

    this.db.exec({
      sql,
      bind,
      rowMode: "object",
      callback: (row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) {
          throw new Error(`Expected object row result, received ${typeof row}.`);
        }

        rows.push(row as SqliteObjectRow);
      },
    });

    return rows;
  }

  /** Execute a SQL query and return only the first row when present. */
  private selectFirst(sql: string, bind: unknown[] = []) {
    const rows = this.selectAll(sql, bind);
    return rows[0] ?? null;
  }

  /** Map one sqlite row into a validated `SpriteRecord`. */
  private toSpriteRecord(row: SqliteObjectRow, index: number): SpriteRecord {
    const spriteId = this.toStringValue(row.id, `sprites[${index}].id`);

    return {
      id: spriteId,
      type: this.toStringValue(row.type, `sprites[${index}].type`),
      pos_x: this.toFiniteNumber(row.pos_x, `sprites[${index}].pos_x`),
      pos_y: this.toFiniteNumber(row.pos_y, `sprites[${index}].pos_y`),
      pos_z: this.toFiniteNumber(row.pos_z, `sprites[${index}].pos_z`),
      metadata: this.toStringValue(row.metadata, `sprites[${index}].metadata`),
    };
  }

  /** Validate and return a required non-empty string scalar. */
  private toStringValue(value: unknown, field: string) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`Expected non-empty string for '${field}', received ${String(value)}.`);
    }

    return value;
  }

  /** Validate and return a finite numeric scalar. */
  private toFiniteNumber(value: unknown, field: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Expected finite number for '${field}', received ${String(value)}.`);
    }

    return parsed;
  }
}
