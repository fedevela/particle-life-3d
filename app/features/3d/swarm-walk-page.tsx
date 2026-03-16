import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState, useRef } from "react";

import { SwarmWalkScene, type SwarmWalkTestApi } from "~/features/3d/swarm-walk-scene";

declare global {
  interface Window {
    __GET_SWARM_WALK_CONTRACT_TEXT__?: (frame?: number) => Promise<string>;
    __GET_SWARM_WALK_FRAME__?: () => number;
    __RESET_SWARM_WALK_SIM_FOR_TEST__?: () => Promise<void>;
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
 * Render the top-level page container for the Swarm-Walk simulation.
 *
 * @returns Returns the full-size canvas page section.
 */
export function SwarmWalkPage() {
  const { isTestMode, seed } = useMemo(() => resolvePageConfiguration(), []);
  const [testApi, setTestApi] = useState<SwarmWalkTestApi | null>(null);
  const sessionSeedRef = useRef<string>(seed ?? (typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString()));
  const resolvedSeed = seed ?? sessionSeedRef.current;

  useEffect(() => {
    if (!isTestMode || !testApi) {
      return;
    }

    window.__GET_SWARM_WALK_CONTRACT_TEXT__ = async (frame) => {
      return testApi.getSwarmWalkContractText(frame);
    };

    window.__GET_SWARM_WALK_FRAME__ = () => testApi.getCurrentFrame();

    window.__RESET_SWARM_WALK_SIM_FOR_TEST__ = async () => {
      await testApi.resetSimulation();
    };

    return () => {
      delete window.__GET_SWARM_WALK_CONTRACT_TEXT__;
      delete window.__GET_SWARM_WALK_FRAME__;
      delete window.__RESET_SWARM_WALK_SIM_FOR_TEST__;
    };
  }, [isTestMode, testApi]);

  return (
    <section className="h-full w-full">
      <Canvas camera={{ position: [0, 10, 20], fov: 60 }}>
        <SwarmWalkScene seed={resolvedSeed} onTestApiReady={setTestApi} />
      </Canvas>
    </section>
  );
}
