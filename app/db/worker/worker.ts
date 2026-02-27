import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import sqliteWasmUrl from "@sqlite.org/sqlite-wasm/sqlite3.wasm?url";

import type {
  CameraState,
  SimulationSnapshotUpsertInput,
  SpriteRecord,
  VariableRecord,
} from "../types";
import { createLogger } from "../../lib/logger";
import { parseHelloShaderWorldMovementParams } from "../../types/hello-shader-world-movement";

import type { DbTable, WorkerRequest, WorkerResponse } from "./messages";
import { SqliteRepository, type SqliteDatabase } from "./sqlite-repository";

/** Define the OPFS SQLite database filename. */
const DATABASE_FILE_NAME = "particle-life.sqlite3";
/** Define the variable key used to store camera state. */
const CAMERA_STATE_NAME = "camera_state";
/** Define the sqlite-wasm OPFS VFS name. */
const OPFS_VFS_NAME = "opfs";
/** Define the default seeded sprite color. */
const SEEDED_SPRITE_COLOR = "#93c5fd";
/** Define a repository label used in worker error messages. */
const SQLITE_REPOSITORY_NAME = "sqlite repository";
/** Provide scoped logs for worker-side persistence activity. */
const logger = createLogger("db-worker");

/** Serialize arbitrary values to JSON and raise a contextual error on failure. */
function stringifyJson(value: unknown, context: string) {
  try {
    return JSON.stringify(value);
  } catch {
    throw new Error(`Failed to serialize ${context}.`);
  }
}

/** Validate that a value is a finite [x, y, z] tuple. */
function isNumberTriple(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((part) => typeof part === "number" && Number.isFinite(part))
  );
}

/** Parse and validate persisted camera state JSON payload. */
function parseCameraState(raw: string): CameraState {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse persisted camera state JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Persisted camera state must be a JSON object.");
  }

  const parsedRecord = parsed as Record<string, unknown>;
  const next = {
    position: parsedRecord.position ?? null,
    target: parsedRecord.target ?? null,
    movementParams: parseHelloShaderWorldMovementParams(parsedRecord.movementParams),
  };

  if (!isNumberTriple(next.position) || !isNumberTriple(next.target)) {
    throw new Error("Persisted camera state must include finite position and target triples.");
  }

  return {
    position: next.position,
    target: next.target,
    movementParams: next.movementParams,
  };
}

function validateSimulationSnapshotPayload(payload: SimulationSnapshotUpsertInput) {
  const milestoneId = payload.milestoneId.trim();
  if (milestoneId.length === 0) {
    throw new Error("Simulation snapshot milestoneId must be non-empty.");
  }

  if (!Number.isInteger(payload.frame) || payload.frame < 0) {
    throw new Error("Simulation snapshot frame must be a non-negative integer.");
  }

  if (!isNumberTriple(payload.payload)) {
    throw new Error("Simulation snapshot payload must be a finite [x, y, z] triple.");
  }

  return {
    milestoneId,
    frame: payload.frame,
    payload: payload.payload,
  };
}

/** Describe the sqlite-wasm API shape consumed by this worker module. */
type SqliteApi = {
  capi: {
    sqlite3_vfs_find: (name: string) => number;
  };
  oo1: {
    DB: new (options: { filename?: string; flags?: string; vfs?: string }) => SqliteDatabase;
  };
};

/** Hold the initialized worker database connection. */
let sqliteDb: SqliteDatabase | null = null;
/** Hold the typed repository wrapper around the SQLite connection. */
let sqliteRepository: SqliteRepository | null = null;
/** Track which tables currently have active subscriptions. */
const subscribedTables = new Set<DbTable>();

/** Post a worker response/event message to the main thread. */
function postMessageToMain(message: WorkerResponse) {
  self.postMessage(message);
}

/** Emit a table update event when that table is currently subscribed. */
function emitTableUpdated(table: DbTable) {
  if (subscribedTables.has(table)) {
    logger.debug("Emit table update event.", { table });
    postMessageToMain({ type: "TABLE_UPDATED", table });
  }
}

/** Throw a namespaced repository error with consistent formatting. */
function repositoryError(detail: string): never {
  throw new Error(`[${SQLITE_REPOSITORY_NAME}] ${detail}`);
}

/** Resolve a sprite ID from payload or generate a new UUIDv4 when omitted. */
function resolveSpriteId(candidateId: string | undefined) {
  if (candidateId) {
    return candidateId;
  }

  return crypto.randomUUID();
}

/** Seed one default sprite for projects with no persisted sprites yet. */
function ensureProjectSeeded(repository: SqliteRepository, projectId: string) {
  const spriteCount = repository.readSpriteCount(projectId);

  if (spriteCount > 0) {
    return;
  }

  logger.info("Seed initial sprite for project.", { projectId });
  repository.insertSprite(
    {
      id: crypto.randomUUID(),
      type: "sphere",
      pos_x: 0,
      pos_y: 0,
      pos_z: 0,
      metadata: stringifyJson({ color: SEEDED_SPRITE_COLOR }, "sprite metadata"),
    },
    projectId,
  );
}

/** Initialize sqlite-wasm + OPFS and ensure schema/seed data exist. */
async function initializeDatabase() {
  if (sqliteRepository && sqliteDb) {
    logger.debug("Reuse existing SQLite database instance.");
    return;
  }

  logger.info("Initialize SQLite database.");

  const sqlite3 = (await sqlite3InitModule({
    locateFile: (path, prefix) => (path === "sqlite3.wasm" ? sqliteWasmUrl : `${prefix}${path}`),
  })) as SqliteApi;

  if (!sqlite3.capi.sqlite3_vfs_find(OPFS_VFS_NAME)) {
    const hint =
      typeof SharedArrayBuffer === "undefined"
        ? "SharedArrayBuffer is unavailable (ensure COOP/COEP headers are set)."
        : "The OPFS VFS could not be registered by sqlite-wasm in this worker.";
    throw new Error(`SQLite OPFS is unavailable. ${hint}`);
  }

  const db = new sqlite3.oo1.DB({
    filename: `/${DATABASE_FILE_NAME}`,
    flags: "c",
    vfs: OPFS_VFS_NAME,
  });

  const repository = new SqliteRepository(db);
  repository.ensureSchema();
  logger.debug("Ensure SQLite schema.");

  sqliteDb = db;
  sqliteRepository = repository;
  logger.info("SQLite database initialization complete.");
}

async function getWorkerRepository() {
  await initializeDatabase();

  if (!sqliteRepository) {
    repositoryError("Database unavailable after initialization.");
  }

  return sqliteRepository;
}

/** Handle one typed request from the main thread. */
async function handleRequest(message: WorkerRequest) {
  logger.debug("Handle worker request.", {
    requestType: message.type,
    requestId: "requestId" in message ? message.requestId : null,
  });

  switch (message.type) {
    case "INIT": {
      await initializeDatabase();
      logger.info("Complete INIT request.", { requestId: message.requestId });
      postMessageToMain({ type: "RESPONSE", requestId: message.requestId, ok: true, data: null });
      return;
    }
    case "GET_SPRITES": {
      const repository = await getWorkerRepository();
      ensureProjectSeeded(repository, message.projectId);
      const sprites = repository.fetchSprites(message.projectId);
      logger.debug("Return sprites from repository.", {
        requestId: message.requestId,
        projectId: message.projectId,
        spriteCount: sprites.length,
      });

      postMessageToMain({
        type: "RESPONSE",
        requestId: message.requestId,
        ok: true,
        data: sprites,
      });
      return;
    }
    case "upsert_sprite": {
      const repository = await getWorkerRepository();

      const recordId = resolveSpriteId(message.payload.id);
      const metadata = stringifyJson(message.payload.metadata ?? {}, "sprite metadata");

      const nextRecord: SpriteRecord = {
        id: recordId,
        type: message.payload.type,
        pos_x: message.payload.position[0],
        pos_y: message.payload.position[1],
        pos_z: message.payload.position[2],
        metadata,
      };

      const existingId = repository.findSpriteId(recordId, message.projectId);
      const operation = existingId !== null ? "update" : "insert";

      if (existingId !== null) {
        repository.updateSprite(nextRecord, message.projectId);
      } else {
        repository.insertSprite(nextRecord, message.projectId);
      }

      logger.info("Persist single sprite.", {
        requestId: message.requestId,
        projectId: message.projectId,
        spriteId: recordId,
        operation,
      });

      emitTableUpdated("sprites");

      postMessageToMain({
        type: "RESPONSE",
        requestId: message.requestId,
        ok: true,
        data: nextRecord,
      });
      return;
    }
    case "upsert_sprites": {
      const repository = await getWorkerRepository();
      const persistedRecords: SpriteRecord[] = [];
      let insertCount = 0;
      let updateCount = 0;

      for (const nextSprite of message.payload) {
        const recordId = resolveSpriteId(nextSprite.id);
        const metadata = stringifyJson(nextSprite.metadata ?? {}, "sprite metadata");

        const nextRecord: SpriteRecord = {
          id: recordId,
          type: nextSprite.type,
          pos_x: nextSprite.position[0],
          pos_y: nextSprite.position[1],
          pos_z: nextSprite.position[2],
          metadata,
        };

        const existingId = repository.findSpriteId(recordId, message.projectId);

        if (existingId !== null) {
          repository.updateSprite(nextRecord, message.projectId);
          updateCount += 1;
        } else {
          repository.insertSprite(nextRecord, message.projectId);
          insertCount += 1;
        }

        persistedRecords.push(nextRecord);
      }

      if (persistedRecords.length > 0) {
        emitTableUpdated("sprites");
      }

      logger.info("Persist sprite batch.", {
        requestId: message.requestId,
        projectId: message.projectId,
        patchSize: message.payload.length,
        persistedCount: persistedRecords.length,
        insertCount,
        updateCount,
      });

      postMessageToMain({
        type: "RESPONSE",
        requestId: message.requestId,
        ok: true,
        data: persistedRecords,
      });
      return;
    }
    case "GET_CAMERA_STATE": {
      const repository = await getWorkerRepository();
      const cameraVariable = repository.findVariableByName(CAMERA_STATE_NAME, message.projectId);

      const parsed = cameraVariable ? parseCameraState(cameraVariable.value) : null;
      logger.debug("Return camera state.", {
        requestId: message.requestId,
        projectId: message.projectId,
        hasCameraState: parsed !== null,
      });

      postMessageToMain({
        type: "RESPONSE",
        requestId: message.requestId,
        ok: true,
        data: parsed,
      });
      return;
    }
    case "SAVE_CAMERA_STATE": {
      const repository = await getWorkerRepository();

      const existing = repository.findVariableByName(CAMERA_STATE_NAME, message.projectId);

      const record: VariableRecord = {
        id: existing !== null ? existing.id : crypto.randomUUID(),
        name: CAMERA_STATE_NAME,
        value: stringifyJson(message.payload, "camera state"),
      };

      if (existing) {
        repository.updateVariableValue(record, message.projectId);
      } else {
        repository.insertVariable(record, message.projectId);
      }

      logger.info("Persist camera state.", {
        requestId: message.requestId,
        projectId: message.projectId,
        operation: existing ? "update" : "insert",
      });

      emitTableUpdated("variables");

      postMessageToMain({ type: "RESPONSE", requestId: message.requestId, ok: true, data: null });
      return;
    }
    case "SAVE_SIMULATION_SNAPSHOT": {
      const repository = await getWorkerRepository();
      const normalizedPayload = validateSimulationSnapshotPayload(message.payload);
      repository.upsertSimulationSnapshot(normalizedPayload, message.projectId);

      logger.info("Persist simulation milestone snapshot.", {
        requestId: message.requestId,
        projectId: message.projectId,
        milestoneId: normalizedPayload.milestoneId,
        frame: normalizedPayload.frame,
      });

      emitTableUpdated("simulation_snapshots");

      postMessageToMain({ type: "RESPONSE", requestId: message.requestId, ok: true, data: null });
      return;
    }
    case "GET_PROJECT_CONTRACT_TEXT": {
      const repository = await getWorkerRepository();
      ensureProjectSeeded(repository, message.projectId);
      const contractText = repository.getProjectContractText(message.projectId, message.scope ?? "all");
      logger.debug("Return project contract text.", {
        requestId: message.requestId,
        projectId: message.projectId,
        scope: message.scope ?? "all",
      });

      postMessageToMain({
        type: "RESPONSE",
        requestId: message.requestId,
        ok: true,
        data: contractText,
      });
      return;
    }
    case "DELETE_PROJECT_DATA": {
      const repository = await getWorkerRepository();
      repository.deleteProjectData(message.projectId);
      logger.info("Delete project data.", {
        requestId: message.requestId,
        projectId: message.projectId,
      });

      emitTableUpdated("sprites");
      emitTableUpdated("variables");
      emitTableUpdated("simulation_snapshots");

      postMessageToMain({ type: "RESPONSE", requestId: message.requestId, ok: true, data: null });
      return;
    }
    case "SUBSCRIBE_TABLE": {
      // Subscriptions are table-scoped to keep cross-thread chatter minimal.
      subscribedTables.add(message.table);
      logger.debug("Subscribe table events.", {
        table: message.table,
        subscribedCount: subscribedTables.size,
      });
      return;
    }
    case "UNSUBSCRIBE_TABLE": {
      subscribedTables.delete(message.table);
      logger.debug("Unsubscribe table events.", {
        table: message.table,
        subscribedCount: subscribedTables.size,
      });
      return;
    }
    default: {
      const exhaustiveCheck: never = message;
      throw new Error(`Unsupported message: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  void handleRequest(message).catch((error: unknown) => {
    logger.error("Worker request failed.", {
      requestType: message.type,
      requestId: "requestId" in message ? message.requestId : null,
      error: error instanceof Error ? error.message : "Unknown worker error",
    });

    if ("requestId" in message) {
      postMessageToMain({
        type: "RESPONSE",
        requestId: message.requestId,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown worker error",
      });
    }
  });
};
