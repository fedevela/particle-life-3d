import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";

import {
  HelloShaderWorldScene,
  type ShaderWorldTestApi,
} from "~/features/3d/hello-shader-world-scene";

declare global {
  interface Window {
    __GET_SHADER_CONTRACT_TEXT__?: (frame?: number) => Promise<string>;
    __GET_SHADER_FRAME__?: () => number;
    __RESET_SHADER_SIM_FOR_TEST__?: () => Promise<void>;
  }
}

function resolvePageConfiguration() {
  if (typeof window === "undefined") {
    return {
      isTestMode: false,
    };
  }

  const searchParams = new URLSearchParams(window.location.search);
  return {
    isTestMode: searchParams.get("testMode") === "true",
  };
}

export function HelloShaderWorldPage() {
  const { isTestMode } = useMemo(() => resolvePageConfiguration(), []);
  const testApiRef = useRef<ShaderWorldTestApi | null>(null);

  useEffect(() => {
    if (!isTestMode) {
      return;
    }

    window.__GET_SHADER_CONTRACT_TEXT__ = async (frame) => {
      const api = testApiRef.current;
      if (!api) {
        throw new Error("Shader test API is not ready yet.");
      }

      return api.getShaderContractText(frame);
    };

    window.__GET_SHADER_FRAME__ = () => {
      const api = testApiRef.current;
      return api ? api.getCurrentFrame() : 0;
    };

    window.__RESET_SHADER_SIM_FOR_TEST__ = async () => {
      const api = testApiRef.current;
      if (!api) {
        throw new Error("Shader test API is not ready yet.");
      }

      api.resetSimulation();
    };

    return () => {
      delete window.__GET_SHADER_CONTRACT_TEXT__;
      delete window.__GET_SHADER_FRAME__;
      delete window.__RESET_SHADER_SIM_FOR_TEST__;
    };
  }, [isTestMode]);

  return (
    <section className="h-full w-full">
      <Canvas camera={{ position: [0, 0, 5], fov: 55 }}>
        <HelloShaderWorldScene
          onTestApiReady={(api) => {
            testApiRef.current = api;
          }}
        />
      </Canvas>
    </section>
  );
}
