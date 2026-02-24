import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";

import { loadCameraState, persistCameraState } from "~/db/client-bridge/bridge";
import type { CameraState } from "~/db/types";

export function CameraPersistenceControls() {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const saveTimerRef = useRef<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    throw error;
  }

  useEffect(() => {
    let isMounted = true;

    void loadCameraState()
      .then((savedState) => {
        if (!isMounted || !savedState) {
          return;
        }

        camera.position.set(savedState.position[0], savedState.position[1], savedState.position[2]);
        controlsRef.current?.target.set(savedState.target[0], savedState.target[1], savedState.target[2]);
        controlsRef.current?.update();
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError : new Error("Failed to load camera state."));
        }
      });

    return () => {
      isMounted = false;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
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
  }, [camera]);

  const onEnd = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void saveCamera().catch((saveError: unknown) => {
        setError(saveError instanceof Error ? saveError : new Error("Failed to persist camera state."));
      });
    }, 250);
  }, [saveCamera]);

  return <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.08} onEnd={onEnd} />;
}
