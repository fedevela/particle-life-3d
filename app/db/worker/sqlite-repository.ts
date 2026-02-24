import type { SpriteRecord, VariableRecord } from "~/db/types";

type SqliteObjectRow = Record<string, unknown>;

/** Define the minimal sqlite-wasm DB interface consumed by the repository wrapper. */
export type SqliteDatabase = {
  exec: (args: {
    sql: string;
    bind?: unknown[];
    rowMode?: "object" | "array";
    callback?: (row: SqliteObjectRow | unknown[]) => void;
  }) => void;
};

/**
 * Encapsulate typed SQLite reads/writes performed in the worker.
 *
 * This class centralizes schema management and row-to-domain mapping.
 */
export class SqliteRepository {
  private readonly db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  /** Ensure required tables exist before any query is executed. */
  public ensureSchema() {
    this.execute(
      "CREATE TABLE IF NOT EXISTS variables (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, value TEXT NOT NULL)",
    );
    this.execute(
      "CREATE TABLE IF NOT EXISTS sprites (id TEXT PRIMARY KEY, type TEXT NOT NULL, pos_x REAL NOT NULL, pos_y REAL NOT NULL, pos_z REAL NOT NULL, metadata TEXT NOT NULL)",
    );
  }

  /**
   * Read the current number of persisted sprites.
   *
   * @returns Returns the current number of persisted sprites.
   */
  public readSpriteCount() {
    const row = this.selectFirst("SELECT COUNT(*) AS count FROM sprites");
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

  /** Insert a new sprite row. */
  public insertSprite(record: SpriteRecord) {
    this.execute(
      "INSERT INTO sprites (id, type, pos_x, pos_y, pos_z, metadata) VALUES (?, ?, ?, ?, ?, ?)",
      [record.id, record.type, record.pos_x, record.pos_y, record.pos_z, record.metadata],
    );
  }

  /** Update an existing sprite row by ID. */
  public updateSprite(record: SpriteRecord) {
    this.execute(
      "UPDATE sprites SET type = ?, pos_x = ?, pos_y = ?, pos_z = ?, metadata = ? WHERE id = ?",
      [record.type, record.pos_x, record.pos_y, record.pos_z, record.metadata, record.id],
    );
  }

  /**
   * Find a sprite row by ID.
   *
   * @returns Returns the sprite ID when found; otherwise `null`.
   */
  public findSpriteId(id: string): string | null {
    const row = this.selectFirst("SELECT id FROM sprites WHERE id = ? LIMIT 1", [id]);
    if (row === null) {
      return null;
    }

    return this.toStringValue(row.id, "sprites.id");
  }

  /**
   * Fetch all sprite rows in insertion order.
   *
   * @returns Returns all sprite rows in insertion order.
   */
  public fetchSprites(): SpriteRecord[] {
    const rows = this.selectAll(
      "SELECT id, type, pos_x, pos_y, pos_z, metadata FROM sprites ORDER BY rowid ASC",
    );

    return rows.map((row, index) => this.toSpriteRecord(row, index));
  }

  /**
   * Find a variable row by name.
   *
   * @returns Returns a variable row for the given name; otherwise `null`.
   */
  public findVariableByName(name: string): VariableRecord | null {
    const row = this.selectFirst("SELECT id, name, value FROM variables WHERE name = ? LIMIT 1", [name]);
    if (row === null) {
      return null;
    }

    return {
      id: this.toStringValue(row.id, "variables.id"),
      name: this.toStringValue(row.name, "variables.name"),
      value: this.toStringValue(row.value, "variables.value"),
    };
  }

  /** Insert a new variable row. */
  public insertVariable(record: VariableRecord) {
    this.execute("INSERT INTO variables (id, name, value) VALUES (?, ?, ?)", [
      record.id,
      record.name,
      record.value,
    ]);
  }

  /** Update a variable value by stable ID and name. */
  public updateVariableValue(record: VariableRecord) {
    this.execute("UPDATE variables SET value = ? WHERE id = ? AND name = ?", [
      record.value,
      record.id,
      record.name,
    ]);
  }

  private execute(sql: string, bind: unknown[] = []) {
    this.db.exec({
      sql,
      bind,
    });
  }

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

  private selectFirst(sql: string, bind: unknown[] = []) {
    const rows = this.selectAll(sql, bind);
    return rows[0] ?? null;
  }

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

  private toStringValue(value: unknown, field: string) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`Expected non-empty string for '${field}', received ${String(value)}.`);
    }

    return value;
  }

  private toFiniteNumber(value: unknown, field: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Expected finite number for '${field}', received ${String(value)}.`);
    }

    return parsed;
  }
}
