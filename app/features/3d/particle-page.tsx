import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";

import {
  deleteProjectData,
  getProjectContractText,
} from "~/db/client-bridge/bridge";
import type {
  CameraPersistenceTestApi,
} from "~/features/3d/camera-persistence-controls";
import type { CameraAction } from "~/features/3d/camera-actions";
import { ParticleScene } from "~/features/3d/particle-scene";

/** Define the persistent scene project for non-test runtime URLs. */
const UI_PROJECT_ID_STORAGE_KEY = "particle-life:ui-project-id";

declare global {
  interface Window {
    __GET_DB_CONTRACT_TEXT__?: (projectId?: string) => Promise<string>;
    __APPLY_CAMERA_ACTION_FOR_TEST__?: (action: CameraAction, projectId?: string) => Promise<void>;
    __DELETE_PROJECT_DATA__?: (projectId?: string) => Promise<void>;
  }
}

/**
 * Render the top-level page container for the Three.js canvas experience.
 *
 * @returns Returns the full-size canvas page section.
 */
export function ParticlePage() {
  const { projectId, isTestMode } = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        projectId: "server-render-placeholder",
        isTestMode: false,
      };
    }

    const searchParams = new URLSearchParams(window.location.search);
    const testModeValue = searchParams.get("testMode");
    const projectIdValue = searchParams.get("projectId")?.trim() ?? "";

    if (testModeValue === "true" && projectIdValue.length === 0) {
      throw new Error("Missing required projectId query parameter in testMode.");
    }

    if (testModeValue === "true") {
      return {
        projectId: projectIdValue,
        isTestMode: true,
      };
    }

    const existingUiProjectId = window.localStorage.getItem(UI_PROJECT_ID_STORAGE_KEY)?.trim() ?? "";
    const uiProjectId = existingUiProjectId.length > 0 ? existingUiProjectId : crypto.randomUUID();

    if (existingUiProjectId.length === 0) {
      window.localStorage.setItem(UI_PROJECT_ID_STORAGE_KEY, uiProjectId);
    }

    return {
      projectId: uiProjectId,
      isTestMode: false,
    };
  }, []);

  const cameraTestApiRef = useRef<CameraPersistenceTestApi | null>(null);

  useEffect(() => {
    if (!isTestMode) {
      return;
    }

    window.__GET_DB_CONTRACT_TEXT__ = (requestedProjectId) =>
      getProjectContractText(requestedProjectId ?? projectId);
    window.__APPLY_CAMERA_ACTION_FOR_TEST__ = async (action, requestedProjectId) => {
      const targetProjectId = requestedProjectId ?? projectId;
      if (targetProjectId !== projectId) {
        throw new Error(
          `Camera action projectId mismatch. Expected '${projectId}' and received '${targetProjectId}'.`,
        );
      }

      const cameraApi = cameraTestApiRef.current;
      if (!cameraApi) {
        throw new Error("Camera test API is not ready yet.");
      }

      await cameraApi.applyCameraActionForTest(action);
    };
    window.__DELETE_PROJECT_DATA__ = async (requestedProjectId) => {
      await deleteProjectData(requestedProjectId ?? projectId);
    };

    return () => {
      delete window.__GET_DB_CONTRACT_TEXT__;
      delete window.__APPLY_CAMERA_ACTION_FOR_TEST__;
      delete window.__DELETE_PROJECT_DATA__;
    };
  }, [isTestMode, projectId]);

  return (
    <section className="h-full w-full">
      <Canvas camera={{ position: [4, 4, 6], fov: 55 }}>
        <ParticleScene
          projectId={projectId}
          onCameraTestApiReady={(api) => {
            cameraTestApiRef.current = api;
          }}
        />
      </Canvas>
    </section>
  );
}
