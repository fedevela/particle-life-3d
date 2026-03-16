import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";

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
      seed: null as string | null,
    };
  }

  const searchParams = new URLSearchParams(window.location.search);
  return {
    isTestMode: searchParams.get("testMode") === "true",
    seed: searchParams.get("seed"),
  };
}

/**
 * Render the top-level page container for the deterministic shader simulation.
 *
 * @returns Returns the full-size canvas page section.
 */
export function HelloShaderWorldPage() {
  const { isTestMode, seed } = useMemo(() => resolvePageConfiguration(), []);
  const sessionSeedRef = useRef<string>(seed ?? crypto.randomUUID());
  const resolvedSeed = seed ?? sessionSeedRef.current;
  const [testApi, setTestApi] = useState<ShaderWorldTestApi | null>(null);

  useEffect(() => {
    if (!isTestMode || !testApi) {
      return;
    }

    window.__GET_SHADER_CONTRACT_TEXT__ = async (frame) => {
      return testApi.getShaderContractText(frame);
    };

    window.__GET_SHADER_FRAME__ = () => testApi.getCurrentFrame();

    window.__RESET_SHADER_SIM_FOR_TEST__ = async () => {
      await testApi.resetSimulation();
    };

    return () => {
      delete window.__GET_SHADER_CONTRACT_TEXT__;
      delete window.__GET_SHADER_FRAME__;
      delete window.__RESET_SHADER_SIM_FOR_TEST__;
    };
  }, [isTestMode, testApi]);

  return (
    <section className="h-full w-full">
      <Canvas camera={{ position: [0, 0, 5], fov: 55 }}>
        <HelloShaderWorldScene
          seed={resolvedSeed}
          onTestApiReady={setTestApi}
        />
      </Canvas>
    </section>
  );
}
