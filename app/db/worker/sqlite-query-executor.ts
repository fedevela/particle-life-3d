/** Represent one sqlite row mapped as an object with unknown scalar values. */
export type SqliteObjectRow = Record<string, unknown>;

/** Define the minimal sqlite-wasm DB interface consumed by the repository wrapper. */
export type SqliteDatabase = {
  exec: (args: {
    sql: string;
    bind?: unknown[];
    rowMode?: "object" | "array";
    callback?: (row: SqliteObjectRow | unknown[]) => void;
  }) => void;
};

export class SqliteQueryExecutor {
  private readonly db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  /** Execute a SQL statement with optional bound parameters. */
  public execute(sql: string, bind: unknown[] = []) {
    this.db.exec({
      sql,
      bind,
    });
  }

  /** Execute a SQL query and return all rows as object records. */
  public selectAll(sql: string, bind: unknown[] = []) {
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
  public selectFirst(sql: string, bind: unknown[] = []) {
    const rows = this.selectAll(sql, bind);
    return rows[0] ?? null;
  }

  /** Validate and return a required non-empty string scalar. */
  public toStringValue(value: unknown, field: string) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`Expected non-empty string for '${field}', received ${String(value)}.`);
    }

    return value;
  }

  /** Validate and return a finite numeric scalar. */
  public toFiniteNumber(value: unknown, field: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Expected finite number for '${field}', received ${String(value)}.`);
    }

    return parsed;
  }
}
