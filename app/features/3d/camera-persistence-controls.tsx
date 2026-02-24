import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { CAMERA_ACTION_STEP_VALUES, type CameraAction } from "~/features/3d/camera-actions";
import { loadCameraState, persistCameraState } from "~/db/client-bridge/bridge";
import type { CameraState } from "~/db/types";
import { createLogger } from "~/lib/logger";

/** Define idle duration before camera state is persisted. */
const IDLE_PERSIST_DELAY_MS = 5000;
/** Define minimum orbit distance from target. */
const MIN_CAMERA_RADIUS = 0.1;
/** Define epsilon used for spherical clamp boundaries. */
const SPHERICAL_EPSILON = 0.000001;
/** Provide scoped logs for camera persistence controls behavior. */
const logger = createLogger("camera-controls");

/** Define test-only camera controls exposed through page globals. */
export type CameraPersistenceTestApi = {
  applyCameraActionForTest: (action: CameraAction) => Promise<void>;
};

/** Define component props for camera persistence controls. */
type CameraPersistenceControlsProps = {
  projectId: string;
  onTestApiReady?: (api: CameraPersistenceTestApi | null) => void;
};

/** Capture current camera + target as a persisted state payload. */
function captureCameraState(camera: THREE.Camera, controls: any): CameraState {
  const perspectiveCamera = camera as THREE.PerspectiveCamera;

  return {
    position: [perspectiveCamera.position.x, perspectiveCamera.position.y, perspectiveCamera.position.z],
    target: [controls.target.x, controls.target.y, controls.target.z],
  };
}

/** Apply one deterministic camera action directly to camera/target values. */
function applyCameraAction(camera: THREE.Camera, controls: any, action: CameraAction) {
  const perspectiveCamera = camera as THREE.PerspectiveCamera;
  const target = controls.target as THREE.Vector3;

  if (action === "pan_left" || action === "pan_right" || action === "pan_up" || action === "pan_down") {
    const lookDirection = new THREE.Vector3()
      .subVectors(target, perspectiveCamera.position)
      .normalize();
    const right = new THREE.Vector3().crossVectors(lookDirection, perspectiveCamera.up).normalize();
    const up = perspectiveCamera.up.clone().normalize();

    let delta = new THREE.Vector3();

    if (action === "pan_left") {
      delta = right.multiplyScalar(-CAMERA_ACTION_STEP_VALUES.panDistance);
    }

    if (action === "pan_right") {
      delta = right.multiplyScalar(CAMERA_ACTION_STEP_VALUES.panDistance);
    }

    if (action === "pan_up") {
      delta = up.multiplyScalar(CAMERA_ACTION_STEP_VALUES.panDistance);
    }

    if (action === "pan_down") {
      delta = up.multiplyScalar(-CAMERA_ACTION_STEP_VALUES.panDistance);
    }

    perspectiveCamera.position.add(delta);
    target.add(delta);
    perspectiveCamera.lookAt(target);
    controls.update();
    return;
  }

  const offset = new THREE.Vector3().subVectors(perspectiveCamera.position, target);
  const spherical = new THREE.Spherical().setFromVector3(offset);

  switch (action) {
    case "zoom_in": {
      spherical.radius = Math.max(
        MIN_CAMERA_RADIUS,
        spherical.radius - CAMERA_ACTION_STEP_VALUES.zoomDistance,
      );
      break;
    }
    case "zoom_out": {
      spherical.radius = spherical.radius + CAMERA_ACTION_STEP_VALUES.zoomDistance;
      break;
    }
    case "orbit_left": {
      spherical.theta = spherical.theta - CAMERA_ACTION_STEP_VALUES.orbitRadians;
      break;
    }
    case "orbit_right": {
      spherical.theta = spherical.theta + CAMERA_ACTION_STEP_VALUES.orbitRadians;
      break;
    }
    case "orbit_up": {
      spherical.phi = THREE.MathUtils.clamp(
        spherical.phi - CAMERA_ACTION_STEP_VALUES.orbitRadians,
        SPHERICAL_EPSILON,
        Math.PI - SPHERICAL_EPSILON,
      );
      break;
    }
    case "orbit_down": {
      spherical.phi = THREE.MathUtils.clamp(
        spherical.phi + CAMERA_ACTION_STEP_VALUES.orbitRadians,
        SPHERICAL_EPSILON,
        Math.PI - SPHERICAL_EPSILON,
      );
      break;
    }
    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unsupported camera action '${exhaustiveCheck}'.`);
    }
  }

  offset.setFromSpherical(spherical);
  perspectiveCamera.position.copy(target).add(offset);
  perspectiveCamera.lookAt(target);
  controls.update();
}

/**
 * Render orbit controls that restore and persist camera state in SQLite.
 *
 * @returns Returns configured orbit controls for the active scene camera.
 */
export function CameraPersistenceControls({
  projectId,
  onTestApiReady,
}: CameraPersistenceControlsProps) {
  /** Hold the Drei OrbitControls instance reference. */
  const controlsRef = useRef<any>(null);
  /** Access the active Three.js camera from the current canvas context. */
  const { camera } = useThree();
  /** Hold the pending idle timer handle for camera persistence. */
  const idleTimerRef = useRef<number | null>(null);
  /** Track whether camera state changed since last persistence. */
  const isDirtyRef = useRef(false);
  /** Store terminal load/save errors to surface through error boundaries. */
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    throw error;
  }

  useEffect(() => {
    let isMounted = true;

    void loadCameraState(projectId)
      .then((savedState) => {
        if (!isMounted || !savedState) {
          logger.debug("Skip camera restore because no saved state is available.");
          return;
        }

        const perspectiveCamera = camera as THREE.PerspectiveCamera;
        perspectiveCamera.position.set(
          savedState.position[0],
          savedState.position[1],
          savedState.position[2],
        );
        controlsRef.current?.target.set(savedState.target[0], savedState.target[1], savedState.target[2]);
        controlsRef.current?.update();
        logger.info("Restore camera state from persistence.", { projectId });
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          logger.error("Load camera state failed.", {
            error: loadError instanceof Error ? loadError.message : String(loadError),
          });
          setError(loadError instanceof Error ? loadError : new Error("Failed to load camera state."));
        }
      });

    return () => {
      isMounted = false;
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }
    };
  }, [camera, projectId]);

  const saveCamera = useCallback(async () => {
    const controls = controlsRef.current;
    if (!controls) {
      throw new Error("Cannot persist camera state before controls are ready.");
    }

    const nextState = captureCameraState(camera, controls);
    await persistCameraState(nextState, projectId);
    logger.debug("Persist camera state snapshot.", { projectId });
  }, [camera, projectId]);

  /** Persist camera state when changes are pending. */
  const flushPersist = useCallback(() => {
    if (!isDirtyRef.current) {
      return;
    }

    isDirtyRef.current = false;
    void saveCamera().catch((saveError: unknown) => {
      logger.error("Persist camera state failed.", {
        error: saveError instanceof Error ? saveError.message : String(saveError),
      });
      setError(saveError instanceof Error ? saveError : new Error("Failed to persist camera state."));
    });
  }, [saveCamera]);

  /** Reset idle timer and schedule a deferred persistence flush. */
  const scheduleIdlePersist = useCallback(() => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
    }

    // Buffer camera writes until the user has been idle for 5 seconds.
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null;
      logger.debug("Flush camera persistence after idle period.", {
        delayMs: IDLE_PERSIST_DELAY_MS,
      });
      flushPersist();
    }, IDLE_PERSIST_DELAY_MS);
  }, [flushPersist]);

  /** Mark camera state dirty after each completed user interaction. */
  const onEnd = useCallback(() => {
    isDirtyRef.current = true;
    logger.debug("Schedule camera persistence after interaction end.");
    scheduleIdlePersist();
  }, [scheduleIdlePersist]);

  const applyCameraActionForTest = useCallback(
    async (action: CameraAction) => {
      const controls = controlsRef.current;
      if (!controls) {
        throw new Error("Cannot apply camera action before controls are ready.");
      }

      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }

      isDirtyRef.current = false;
      applyCameraAction(camera, controls, action);
      const nextState = captureCameraState(camera, controls);
      await persistCameraState(nextState, projectId);
      logger.info("Applied test camera action.", { action, projectId });
    },
    [camera, projectId],
  );

  useEffect(() => {
    if (!onTestApiReady) {
      return;
    }

    onTestApiReady({ applyCameraActionForTest });
    return () => {
      onTestApiReady(null);
    };
  }, [applyCameraActionForTest, onTestApiReady]);

  return <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.08} onEnd={onEnd} />;
}
