import type { CameraState, SpriteRecord, SpriteUpsertInput } from "~/db/types";

export type DbTable = "variables" | "sprites";

export type WorkerRequest =
  | { type: "INIT"; requestId: string }
  | { type: "GET_SPRITES"; requestId: string }
  | { type: "UPSERT_SPRITE"; requestId: string; payload: SpriteUpsertInput }
  | { type: "GET_CAMERA_STATE"; requestId: string }
  | { type: "SAVE_CAMERA_STATE"; requestId: string; payload: CameraState }
  | { type: "SUBSCRIBE_TABLE"; table: DbTable }
  | { type: "UNSUBSCRIBE_TABLE"; table: DbTable };

export type WorkerSuccessResponse =
  | { type: "RESPONSE"; requestId: string; ok: true; data: null }
  | { type: "RESPONSE"; requestId: string; ok: true; data: SpriteRecord[] }
  | { type: "RESPONSE"; requestId: string; ok: true; data: SpriteRecord }
  | { type: "RESPONSE"; requestId: string; ok: true; data: CameraState | null };

export type WorkerErrorResponse = {
  type: "RESPONSE";
  requestId: string;
  ok: false;
  error: string;
};

export type WorkerEvent = { type: "TABLE_UPDATED"; table: DbTable };

export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse | WorkerEvent;
