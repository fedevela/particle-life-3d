import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";

import { loadCameraState, persistCameraState } from "~/db/client-bridge/bridge";
import type { CameraState } from "~/db/types";
import { createLogger } from "~/lib/logger";

/** Define idle duration before camera state is persisted. */
const IDLE_PERSIST_DELAY_MS = 5000;
/** Provide scoped logs for camera persistence controls behavior. */
const logger = createLogger("camera-controls");

/**
 * Render orbit controls that restore and persist camera state in SQLite.
 *
 * @returns Returns configured orbit controls for the active scene camera.
 */
export function CameraPersistenceControls() {
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

    void loadCameraState()
      .then((savedState) => {
        if (!isMounted || !savedState) {
          logger.debug("Skip camera restore because no saved state is available.");
          return;
        }

        camera.position.set(savedState.position[0], savedState.position[1], savedState.position[2]);
        controlsRef.current?.target.set(savedState.target[0], savedState.target[1], savedState.target[2]);
        controlsRef.current?.update();
        logger.info("Restore camera state from persistence.");
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
  }, [camera]);

  const saveCamera = useCallback(async () => {
    const controls = controlsRef.current;
    if (!controls) {
      throw new Error("Cannot persist camera state before controls are ready.");
    }

    const nextState: CameraState = {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
    };

    await persistCameraState(nextState);
    logger.debug("Persist camera state snapshot.");
  }, [camera]);

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

  return <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.08} onEnd={onEnd} />;
}
