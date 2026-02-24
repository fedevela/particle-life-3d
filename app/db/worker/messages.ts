import type { CameraState, SpriteRecord, SpriteUpsertInput } from "~/db/types";

/** Define tables that can emit live update events from the worker. */
export type DbTable = "variables" | "sprites";

/** Define deterministic DB contract export scopes used by integration tests. */
export type ContractScope = "all" | "sprites" | "variables";

/** Define the request contract sent from main thread to the SQLite worker. */
export type WorkerRequest =
  | { type: "INIT"; requestId: string }
  | { type: "GET_SPRITES"; requestId: string; projectId: string }
  | { type: "upsert_sprite"; requestId: string; projectId: string; payload: SpriteUpsertInput }
  | { type: "upsert_sprites"; requestId: string; projectId: string; payload: SpriteUpsertInput[] }
  | { type: "GET_CAMERA_STATE"; requestId: string; projectId: string }
  | { type: "SAVE_CAMERA_STATE"; requestId: string; projectId: string; payload: CameraState }
  | {
      type: "GET_PROJECT_CONTRACT_TEXT";
      requestId: string;
      projectId: string;
      scope?: ContractScope;
    }
  | { type: "DELETE_PROJECT_DATA"; requestId: string; projectId: string }
  | { type: "SUBSCRIBE_TABLE"; table: DbTable }
  | { type: "UNSUBSCRIBE_TABLE"; table: DbTable };

/** Define success responses returned by the SQLite worker. */
export type WorkerSuccessResponse =
  | { type: "RESPONSE"; requestId: string; ok: true; data: null }
  | { type: "RESPONSE"; requestId: string; ok: true; data: SpriteRecord[] }
  | { type: "RESPONSE"; requestId: string; ok: true; data: SpriteRecord }
  | { type: "RESPONSE"; requestId: string; ok: true; data: CameraState | null }
  | { type: "RESPONSE"; requestId: string; ok: true; data: string };

/** Define the error response shape returned by the SQLite worker. */
export type WorkerErrorResponse = {
  type: "RESPONSE";
  requestId: string;
  ok: false;
  error: string;
};

/** Define the event emitted when subscribed table data changes. */
export type WorkerEvent = { type: "TABLE_UPDATED"; table: DbTable };

/** Define the union of all response and event messages posted by the worker. */
export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse | WorkerEvent;
