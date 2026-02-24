export type JsonRecord = Record<string, unknown>;

export type VariableRecord = {
  id: string;
  name: string;
  value: string;
};

export type SpriteRecord = {
  id: string;
  type: string;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  metadata: string;
};

export type SpriteEntity = {
  id: string;
  type: string;
  position: [number, number, number];
  metadata: JsonRecord;
};

export type SpriteUpsertInput = {
  id?: string;
  type: string;
  position: [number, number, number];
  metadata?: JsonRecord;
};

export type CameraState = {
  position: [number, number, number];
  target: [number, number, number];
};
