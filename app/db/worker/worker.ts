import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import sqliteWasmUrl from "@sqlite.org/sqlite-wasm/sqlite3.wasm?url";

import type { CameraState, SpriteRecord, VariableRecord } from "~/db/types";

import type { DbTable, WorkerRequest, WorkerResponse } from "./messages";
import { SqliteRepository, type SqliteDatabase } from "./sqlite-repository";

const DATABASE_FILE_NAME = "particle-life.sqlite3";
const CAMERA_STATE_NAME = "camera_state";
const OPFS_VFS_NAME = "opfs";
const SEEDED_SPRITE_COLOR = "#93c5fd";
const SQLITE_REPOSITORY_NAME = "sqlite repository";

function stringifyJson(value: unknown, context: string) {
  try {
    return JSON.stringify(value);
  } catch {
    throw new Error(`Failed to serialize ${context}.`);
  }
}

function isNumberTriple(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((part) => typeof part === "number" && Number.isFinite(part))
  );
}

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
  };

  if (!isNumberTriple(next.position) || !isNumberTriple(next.target)) {
    throw new Error("Persisted camera state must include finite position and target triples.");
  }

  return {
    position: next.position,
    target: next.target,
  };
}

type SqliteApi = {
  capi: {
    sqlite3_vfs_find: (name: string) => number;
  };
  oo1: {
    DB: new (options: { filename?: string; flags?: string; vfs?: string }) => SqliteDatabase;
  };
};

let sqliteDb: SqliteDatabase | null = null;
let sqliteRepository: SqliteRepository | null = null;
const subscribedTables = new Set<DbTable>();

function postMessageToMain(message: WorkerResponse) {
  self.postMessage(message);
}

function emitTableUpdated(table: DbTable) {
  if (subscribedTables.has(table)) {
    postMessageToMain({ type: "TABLE_UPDATED", table });
  }
}

function repositoryError(detail: string): never {
  throw new Error(`[${SQLITE_REPOSITORY_NAME}] ${detail}`);
}

async function initializeDatabase() {
  if (sqliteRepository && sqliteDb) {
    return;
  }

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

  const spriteCount = repository.readSpriteCount();

  // Seed a default sphere so the first load always has visible content.
  if (spriteCount === 0) {
    repository.insertSprite({
      id: crypto.randomUUID(),
      type: "sphere",
      pos_x: 0,
      pos_y: 0,
      pos_z: 0,
      metadata: stringifyJson({ color: SEEDED_SPRITE_COLOR }, "sprite metadata"),
    });
  }

  sqliteDb = db;
  sqliteRepository = repository;
}

async function getWorkerRepository() {
  await initializeDatabase();

  if (!sqliteRepository) {
    repositoryError("Database unavailable after initialization.");
  }

  return sqliteRepository;
}

async function handleRequest(message: WorkerRequest) {
  switch (message.type) {
    case "INIT": {
      await initializeDatabase();
      postMessageToMain({ type: "RESPONSE", requestId: message.requestId, ok: true, data: null });
      return;
    }
    case "GET_SPRITES": {
      const repository = await getWorkerRepository();
      const sprites = repository.fetchSprites();

      postMessageToMain({
        type: "RESPONSE",
        requestId: message.requestId,
        ok: true,
        data: sprites,
      });
      return;
    }
    case "UPSERT_SPRITE": {
      const repository = await getWorkerRepository();

      const recordId = message.payload.id ?? crypto.randomUUID();
      const metadata = stringifyJson(message.payload.metadata ?? {}, "sprite metadata");

      const nextRecord: SpriteRecord = {
        id: recordId,
        type: message.payload.type,
        pos_x: message.payload.position[0],
        pos_y: message.payload.position[1],
        pos_z: message.payload.position[2],
        metadata,
      };

      const existingId = repository.findSpriteId(recordId);

      if (existingId !== null) {
        repository.updateSprite(nextRecord);
      } else {
        repository.insertSprite(nextRecord);
      }

      emitTableUpdated("sprites");

      postMessageToMain({
        type: "RESPONSE",
        requestId: message.requestId,
        ok: true,
        data: nextRecord,
      });
      return;
    }
    case "GET_CAMERA_STATE": {
      const repository = await getWorkerRepository();
      const cameraVariable = repository.findVariableByName(CAMERA_STATE_NAME);

      const parsed = cameraVariable ? parseCameraState(cameraVariable.value) : null;

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

      const existing = repository.findVariableByName(CAMERA_STATE_NAME);

      const record: VariableRecord = {
        id: existing !== null ? existing.id : crypto.randomUUID(),
        name: CAMERA_STATE_NAME,
        value: stringifyJson(message.payload, "camera state"),
      };

      if (existing) {
        repository.updateVariableValue(record);
      } else {
        repository.insertVariable(record);
      }

      emitTableUpdated("variables");

      postMessageToMain({ type: "RESPONSE", requestId: message.requestId, ok: true, data: null });
      return;
    }
    case "SUBSCRIBE_TABLE": {
      // Subscriptions are table-scoped to keep cross-thread chatter minimal.
      subscribedTables.add(message.table);
      return;
    }
    case "UNSUBSCRIBE_TABLE": {
      subscribedTables.delete(message.table);
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
