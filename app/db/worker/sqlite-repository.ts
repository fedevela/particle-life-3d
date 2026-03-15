import type { ContractScope } from "~/db/worker/messages";
import { formatSimulationMilestoneSection, formatSpriteSection, formatVariableSection } from "./sqlite-contract-format";
import {
  SqliteQueryExecutor,
  type SqliteDatabase,
  type SqliteObjectRow,
} from "./sqlite-query-executor";
import { ensureSqliteSchema } from "./sqlite-schema";
import type {
  SimulationSnapshotRecord,
  SimulationSnapshotUpsertInput,
  SpriteRecord,
  VariableRecord,
} from "~/db/types";

export type { SqliteDatabase } from "./sqlite-query-executor";

/** Return a normalized project ID or throw when invalid. */
function normalizeProjectId(projectId: string) {
  const normalized = projectId.trim();
  if (normalized.length === 0) {
    throw new Error("Expected projectId to be a non-empty string.");
  }

  return normalized;
}

/**
 * Encapsulate typed SQLite reads/writes performed in the worker.
 *
 * This class centralizes schema management and row-to-domain mapping.
 */
export class SqliteRepository {
  /** Store the typed query executor over sqlite-wasm. */
  private readonly query: SqliteQueryExecutor;

  /** Initialize repository with a sqlite database adapter. */
  constructor(db: SqliteDatabase) {
    this.query = new SqliteQueryExecutor(db);
  }

  /** Ensure required tables exist before any query is executed. */
  public ensureSchema() {
    ensureSqliteSchema(this.query);
  }

  public upsertSimulationSnapshot(payload: SimulationSnapshotUpsertInput, projectId: string) {
    const normalizedProjectId = normalizeProjectId(projectId);

    this.query.execute(
      "INSERT INTO simulation_snapshots (project_id, milestone_id, frame, payload_x, payload_y, payload_z) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(project_id, milestone_id) DO UPDATE SET frame = excluded.frame, payload_x = excluded.payload_x, payload_y = excluded.payload_y, payload_z = excluded.payload_z",
      [
        normalizedProjectId,
        payload.milestoneId,
        payload.frame,
        payload.payload[0],
        payload.payload[1],
        payload.payload[2],
      ],
    );
  }

  /** Read the number of persisted sprites for one project. */
  public readSpriteCount(projectId: string) {
    const normalizedProjectId = normalizeProjectId(projectId);
    const row = this.query.selectFirst("SELECT COUNT(*) AS count FROM sprites WHERE project_id = ?", [
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

    this.query.execute(
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

    this.query.execute(
      "UPDATE sprites SET type = ?, pos_x = ?, pos_y = ?, pos_z = ?, metadata = ? WHERE id = ? AND project_id = ?",
      [record.type, record.pos_x, record.pos_y, record.pos_z, record.metadata, record.id, normalizedProjectId],
    );
  }

  /** Find a sprite row by ID in one project. */
  public findSpriteId(id: string, projectId: string): string | null {
    const normalizedProjectId = normalizeProjectId(projectId);
    const row = this.query.selectFirst("SELECT id FROM sprites WHERE id = ? AND project_id = ? LIMIT 1", [
      id,
      normalizedProjectId,
    ]);
    if (row === null) {
      return null;
    }

    return this.query.toStringValue(row.id, "sprites.id");
  }

  /** Fetch all sprite rows for one project in insertion order. */
  public fetchSprites(projectId: string): SpriteRecord[] {
    const normalizedProjectId = normalizeProjectId(projectId);
    const rows = this.query.selectAll(
      "SELECT id, type, pos_x, pos_y, pos_z, metadata FROM sprites WHERE project_id = ? ORDER BY rowid ASC",
      [normalizedProjectId],
    );

    return rows.map((row, index) => this.toSpriteRecord(row, index));
  }

  /** Find a variable row by name in one project. */
  public findVariableByName(name: string, projectId: string): VariableRecord | null {
    const normalizedProjectId = normalizeProjectId(projectId);
    const row = this.query.selectFirst(
      "SELECT id, name, value FROM variables WHERE project_id = ? AND name = ? LIMIT 1",
      [normalizedProjectId, name],
    );
    if (row === null) {
      return null;
    }

    return {
      id: this.query.toStringValue(row.id, "variables.id"),
      name: this.query.toStringValue(row.name, "variables.name"),
      value: this.query.toStringValue(row.value, "variables.value"),
    };
  }

  /** Insert a new variable row for one project. */
  public insertVariable(record: VariableRecord, projectId: string) {
    const normalizedProjectId = normalizeProjectId(projectId);

    this.query.execute("INSERT INTO variables (id, project_id, name, value) VALUES (?, ?, ?, ?)", [
      record.id,
      normalizedProjectId,
      record.name,
      record.value,
    ]);
  }

  /** Update a variable value by stable ID/name in one project. */
  public updateVariableValue(record: VariableRecord, projectId: string) {
    const normalizedProjectId = normalizeProjectId(projectId);

    this.query.execute("UPDATE variables SET value = ? WHERE id = ? AND project_id = ? AND name = ?", [
      record.value,
      record.id,
      normalizedProjectId,
      record.name,
    ]);
  }

  /** Delete all persisted data for one project. */
  public deleteProjectData(projectId: string) {
    const normalizedProjectId = normalizeProjectId(projectId);

    this.query.execute("DELETE FROM sprites WHERE project_id = ?", [normalizedProjectId]);
    this.query.execute("DELETE FROM variables WHERE project_id = ?", [normalizedProjectId]);
    this.query.execute("DELETE FROM simulation_snapshots WHERE project_id = ?", [normalizedProjectId]);
  }

  /** Return deterministic text contract for one project and selected scope. */
  public getProjectContractText(projectId: string, scope: ContractScope = "all") {
    const normalizedProjectId = normalizeProjectId(projectId);

    const spriteSection = formatSpriteSection(normalizedProjectId, this.query);
    const variableSection = formatVariableSection(normalizedProjectId, this.query);
    const simulationMilestoneSection = formatSimulationMilestoneSection(normalizedProjectId, this.query);

    if (scope === "sprites") {
      return `${spriteSection}\n`;
    }

    if (scope === "variables") {
      return `${variableSection}\n`;
    }

    if (scope === "simulation_milestones") {
      return `${simulationMilestoneSection}\n`;
    }

    return `${spriteSection}\n\n${variableSection}\n`;
  }

  public fetchSimulationSnapshots(projectId: string): SimulationSnapshotRecord[] {
    const normalizedProjectId = normalizeProjectId(projectId);
    const rows = this.query.selectAll(
      "SELECT project_id, milestone_id, frame, payload_x, payload_y, payload_z FROM simulation_snapshots WHERE project_id = ? ORDER BY frame ASC, milestone_id ASC",
      [normalizedProjectId],
    );

    return rows.map((row, index) => ({
      project_id: this.query.toStringValue(row.project_id, `simulation_snapshots[${index}].project_id`),
      milestone_id: this.query.toStringValue(row.milestone_id, `simulation_snapshots[${index}].milestone_id`),
      frame: this.query.toFiniteNumber(row.frame, `simulation_snapshots[${index}].frame`),
      payload_x: this.query.toFiniteNumber(row.payload_x, `simulation_snapshots[${index}].payload_x`),
      payload_y: this.query.toFiniteNumber(row.payload_y, `simulation_snapshots[${index}].payload_y`),
      payload_z: this.query.toFiniteNumber(row.payload_z, `simulation_snapshots[${index}].payload_z`),
    }));
  }

  /** Map one sqlite row into a validated `SpriteRecord`. */
  private toSpriteRecord(row: SqliteObjectRow, index: number): SpriteRecord {
    const spriteId = this.query.toStringValue(row.id, `sprites[${index}].id`);

    return {
      id: spriteId,
      type: this.query.toStringValue(row.type, `sprites[${index}].type`),
      pos_x: this.query.toFiniteNumber(row.pos_x, `sprites[${index}].pos_x`),
      pos_y: this.query.toFiniteNumber(row.pos_y, `sprites[${index}].pos_y`),
      pos_z: this.query.toFiniteNumber(row.pos_z, `sprites[${index}].pos_z`),
      metadata: this.query.toStringValue(row.metadata, `sprites[${index}].metadata`),
    };
  }
}
