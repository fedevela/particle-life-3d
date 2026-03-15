import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  HelloShaderWorldScene,
  type ShaderContractTestHarnessApi,
} from "~/features/3d/hello-shader-world/hello-shader-world-scene";

declare global {
  interface Window {
    __GET_SHADER_CONTRACT_TEXT__?: (frame?: number) => Promise<string>;
    __GET_SHADER_FRAME__?: () => number;
    __RESET_SHADER_SIM_FOR_TEST__?: () => Promise<void>;
  }
}

function resolveShaderPageConfiguration() {
  if (typeof window === "undefined") {
    return {
      isContractTestMode: false,
      seed: null as string | null,
    };
  }

  const searchParams = new URLSearchParams(window.location.search);
  return {
    isContractTestMode: searchParams.get("testMode") === "true",
    seed: searchParams.get("seed"),
  };
}

export function HelloShaderWorldPage() {
  const { isContractTestMode, seed } = useMemo(() => resolveShaderPageConfiguration(), []);
  const sessionSeedRef = useRef<string>(seed ?? crypto.randomUUID());
  const resolvedSessionSeed = seed ?? sessionSeedRef.current;
  const [shaderContractHarnessApi, setShaderContractHarnessApi] = useState<ShaderContractTestHarnessApi | null>(null);

  useEffect(() => {
    if (!isContractTestMode || !shaderContractHarnessApi) {
      return;
    }

    window.__GET_SHADER_CONTRACT_TEXT__ = async (frame) => {
      return shaderContractHarnessApi.getShaderContractText(frame);
    };

    window.__GET_SHADER_FRAME__ = () => shaderContractHarnessApi.getCurrentFrame();

    window.__RESET_SHADER_SIM_FOR_TEST__ = async () => {
      await shaderContractHarnessApi.resetSimulation();
    };

    return () => {
      delete window.__GET_SHADER_CONTRACT_TEXT__;
      delete window.__GET_SHADER_FRAME__;
      delete window.__RESET_SHADER_SIM_FOR_TEST__;
    };
  }, [isContractTestMode, shaderContractHarnessApi]);

  return (
    <section className="h-full w-full">
      <Canvas camera={{ position: [0, 0, 5], fov: 55 }}>
        <HelloShaderWorldScene
          seed={resolvedSessionSeed}
          onTestApiReady={setShaderContractHarnessApi}
        />
      </Canvas>
    </section>
  );
}
