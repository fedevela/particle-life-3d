import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import sqliteWasmUrl from "@sqlite.org/sqlite-wasm/sqlite3.wasm?url";

import type {
  CameraState,
  SimulationSnapshotUpsertInput,
  SpriteRecord,
  SpriteUpsertInput,
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
let workerSqliteDatabase: SqliteDatabase | null = null;
/** Hold the typed repository wrapper around the SQLite connection. */
let workerSqliteRepository: SqliteRepository | null = null;
/** Track which tables currently have active subscriptions. */
const subscribedTablesByName = new Set<DbTable>();

/** Post a worker response/event message to the main thread. */
function postWorkerResponse(message: WorkerResponse) {
  self.postMessage(message);
}

type WorkerSuccessData = Extract<WorkerResponse, { type: "RESPONSE"; ok: true }>["data"];

function postWorkerSuccessResponse(requestId: string, data: WorkerSuccessData) {
  postWorkerResponse({
    type: "RESPONSE",
    requestId,
    ok: true,
    data,
  });
}

/** Emit a table update event when that table is currently subscribed. */
function emitSubscribedTableUpdate(table: DbTable) {
  if (subscribedTablesByName.has(table)) {
    logger.debug("Emit table update event.", { table });
    postWorkerResponse({ type: "TABLE_UPDATED", table });
  }
}

function emitSubscribedTableUpdates(tables: DbTable[]) {
  for (const table of tables) {
    emitSubscribedTableUpdate(table);
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

function toSpriteRecord(payload: SpriteUpsertInput, recordId: string): SpriteRecord {
  return {
    id: recordId,
    type: payload.type,
    pos_x: payload.position[0],
    pos_y: payload.position[1],
    pos_z: payload.position[2],
    metadata: stringifyJson(payload.metadata ?? {}, "sprite metadata"),
  };
}

function upsertSpriteRecordForProject(
  repository: SqliteRepository,
  nextRecord: SpriteRecord,
  projectId: string,
) {
  const existingId = repository.findSpriteId(nextRecord.id, projectId);
  const operation = existingId !== null ? "update" : "insert";

  if (existingId !== null) {
    repository.updateSprite(nextRecord, projectId);
  } else {
    repository.insertSprite(nextRecord, projectId);
  }

  return operation;
}

/** Seed one default sprite for projects with no persisted sprites yet. */
function ensureProjectHasSeedSprite(repository: SqliteRepository, projectId: string) {
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
async function initializeWorkerDatabase() {
  if (workerSqliteRepository && workerSqliteDatabase) {
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

  workerSqliteDatabase = db;
  workerSqliteRepository = repository;
  logger.info("SQLite database initialization complete.");
}

async function getInitializedWorkerRepository() {
  await initializeWorkerDatabase();

  if (!workerSqliteRepository) {
    repositoryError("Database unavailable after initialization.");
  }

  return workerSqliteRepository;
}

/** Handle one typed request from the main thread. */
async function handleWorkerRequest(workerRequest: WorkerRequest) {
  logger.debug("Handle worker request.", {
    requestType: workerRequest.type,
    requestId: "requestId" in workerRequest ? workerRequest.requestId : null,
  });

  switch (workerRequest.type) {
    case "INIT": {
      await initializeWorkerDatabase();
      logger.info("Complete INIT request.", { requestId: workerRequest.requestId });
      postWorkerSuccessResponse(workerRequest.requestId, null);
      return;
    }
    case "GET_SPRITES": {
      const repository = await getInitializedWorkerRepository();
      ensureProjectHasSeedSprite(repository, workerRequest.projectId);
      const sprites = repository.fetchSprites(workerRequest.projectId);
      logger.debug("Return sprites from repository.", {
        requestId: workerRequest.requestId,
        projectId: workerRequest.projectId,
        spriteCount: sprites.length,
      });

      postWorkerSuccessResponse(workerRequest.requestId, sprites);
      return;
    }
    case "upsert_sprite": {
      const repository = await getInitializedWorkerRepository();

      const recordId = resolveSpriteId(workerRequest.payload.id);
      const nextRecord = toSpriteRecord(workerRequest.payload, recordId);
      const operation = upsertSpriteRecordForProject(repository, nextRecord, workerRequest.projectId);

      logger.info("Persist single sprite.", {
        requestId: workerRequest.requestId,
        projectId: workerRequest.projectId,
        spriteId: recordId,
        operation,
      });

      emitSubscribedTableUpdate("sprites");
      postWorkerSuccessResponse(workerRequest.requestId, nextRecord);
      return;
    }
    case "upsert_sprites": {
      const repository = await getInitializedWorkerRepository();
      const persistedRecords: SpriteRecord[] = [];
      let insertCount = 0;
      let updateCount = 0;

      for (const nextSprite of workerRequest.payload) {
        const recordId = resolveSpriteId(nextSprite.id);
        const nextRecord = toSpriteRecord(nextSprite, recordId);
        const operation = upsertSpriteRecordForProject(repository, nextRecord, workerRequest.projectId);

        if (operation === "update") {
          updateCount += 1;
        } else {
          insertCount += 1;
        }

        persistedRecords.push(nextRecord);
      }

      if (persistedRecords.length > 0) {
        emitSubscribedTableUpdate("sprites");
      }

      logger.info("Persist sprite batch.", {
        requestId: workerRequest.requestId,
        projectId: workerRequest.projectId,
        patchSize: workerRequest.payload.length,
        persistedCount: persistedRecords.length,
        insertCount,
        updateCount,
      });

      postWorkerSuccessResponse(workerRequest.requestId, persistedRecords);
      return;
    }
    case "GET_CAMERA_STATE": {
      const repository = await getInitializedWorkerRepository();
      const cameraVariable = repository.findVariableByName(CAMERA_STATE_NAME, workerRequest.projectId);

      const parsed = cameraVariable ? parseCameraState(cameraVariable.value) : null;
      logger.debug("Return camera state.", {
        requestId: workerRequest.requestId,
        projectId: workerRequest.projectId,
        hasCameraState: parsed !== null,
      });

      postWorkerSuccessResponse(workerRequest.requestId, parsed);
      return;
    }
    case "SAVE_CAMERA_STATE": {
      const repository = await getInitializedWorkerRepository();

      const existing = repository.findVariableByName(CAMERA_STATE_NAME, workerRequest.projectId);

      const record: VariableRecord = {
        id: existing !== null ? existing.id : crypto.randomUUID(),
        name: CAMERA_STATE_NAME,
        value: stringifyJson(workerRequest.payload, "camera state"),
      };

      if (existing) {
        repository.updateVariableValue(record, workerRequest.projectId);
      } else {
        repository.insertVariable(record, workerRequest.projectId);
      }

      logger.info("Persist camera state.", {
        requestId: workerRequest.requestId,
        projectId: workerRequest.projectId,
        operation: existing ? "update" : "insert",
      });

      emitSubscribedTableUpdate("variables");
      postWorkerSuccessResponse(workerRequest.requestId, null);
      return;
    }
    case "SAVE_SIMULATION_SNAPSHOT": {
      const repository = await getInitializedWorkerRepository();
      const normalizedPayload = validateSimulationSnapshotPayload(workerRequest.payload);
      repository.upsertSimulationSnapshot(normalizedPayload, workerRequest.projectId);

      logger.info("Persist simulation milestone snapshot.", {
        requestId: workerRequest.requestId,
        projectId: workerRequest.projectId,
        milestoneId: normalizedPayload.milestoneId,
        frame: normalizedPayload.frame,
      });

      emitSubscribedTableUpdate("simulation_snapshots");
      postWorkerSuccessResponse(workerRequest.requestId, null);
      return;
    }
    case "GET_PROJECT_CONTRACT_TEXT": {
      const repository = await getInitializedWorkerRepository();
      ensureProjectHasSeedSprite(repository, workerRequest.projectId);
      const contractText = repository.getProjectContractText(workerRequest.projectId, workerRequest.scope ?? "all");
      logger.debug("Return project contract text.", {
        requestId: workerRequest.requestId,
        projectId: workerRequest.projectId,
        scope: workerRequest.scope ?? "all",
      });

      postWorkerSuccessResponse(workerRequest.requestId, contractText);
      return;
    }
    case "DELETE_PROJECT_DATA": {
      const repository = await getInitializedWorkerRepository();
      repository.deleteProjectData(workerRequest.projectId);
      logger.info("Delete project data.", {
        requestId: workerRequest.requestId,
        projectId: workerRequest.projectId,
      });

      emitSubscribedTableUpdates(["sprites", "variables", "simulation_snapshots"]);
      postWorkerSuccessResponse(workerRequest.requestId, null);
      return;
    }
    case "SUBSCRIBE_TABLE": {
      // Subscriptions are table-scoped to keep cross-thread chatter minimal.
      subscribedTablesByName.add(workerRequest.table);
      logger.debug("Subscribe table events.", {
        table: workerRequest.table,
        subscribedCount: subscribedTablesByName.size,
      });
      return;
    }
    case "UNSUBSCRIBE_TABLE": {
      subscribedTablesByName.delete(workerRequest.table);
      logger.debug("Unsubscribe table events.", {
        table: workerRequest.table,
        subscribedCount: subscribedTablesByName.size,
      });
      return;
    }
    default: {
      const exhaustiveCheck: never = workerRequest;
      throw new Error(`Unsupported message: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const workerRequest = event.data;

  void handleWorkerRequest(workerRequest).catch((error: unknown) => {
    logger.error("Worker request failed.", {
      requestType: workerRequest.type,
      requestId: "requestId" in workerRequest ? workerRequest.requestId : null,
      error: error instanceof Error ? error.message : "Unknown worker error",
    });

    if ("requestId" in workerRequest) {
      postWorkerResponse({
        type: "RESPONSE",
        requestId: workerRequest.requestId,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown worker error",
      });
    }
  });
};
