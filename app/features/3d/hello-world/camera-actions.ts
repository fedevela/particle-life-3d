export const CAMERA_ACTIONS = [
  "zoom_in",
  "zoom_out",
  "orbit_left",
  "orbit_right",
  "orbit_up",
  "orbit_down",
  "pan_left",
  "pan_right",
  "pan_up",
  "pan_down",
] as const;

export type CameraAction = (typeof CAMERA_ACTIONS)[number];

export const CAMERA_ACTION_STEP_VALUES = {
  zoomDistance: 0.75,
  orbitRadians: Math.PI / 18,
  panDistance: 0.35,
} as const;
