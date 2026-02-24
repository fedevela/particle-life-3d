/** Define a JSON object payload used for flexible metadata fields. */
export type JsonRecord = Record<string, unknown>;

/** Define a persisted key/value row stored in the `variables` table. */
export type VariableRecord = {
  id: string;
  name: string;
  value: string;
};

/** Define a raw persisted sprite row stored in the `sprites` table. */
export type SpriteRecord = {
  id: string;
  type: string;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  metadata: string;
};

/** Define a UI-ready sprite entity consumed by Three.js scene components. */
export type SpriteEntity = {
  id: string;
  type: string;
  position: [number, number, number];
  metadata: JsonRecord;
};

/** Define an input payload for sprite insert/update operations through the worker bridge. */
export type SpriteUpsertInput = {
  id?: string;
  type: string;
  position: [number, number, number];
  metadata?: JsonRecord;
};

/** Define a camera transform persisted across sessions. */
export type CameraState = {
  position: [number, number, number];
  target: [number, number, number];
};

export type SimulationSnapshotRecord = {
  project_id: string;
  milestone_id: string;
  frame: number;
  payload_x: number;
  payload_y: number;
  payload_z: number;
};

export type SimulationSnapshotUpsertInput = {
  milestoneId: string;
  frame: number;
  payload: [number, number, number];
};
