import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";

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
    };
  }

  const searchParams = new URLSearchParams(window.location.search);
  return {
    isTestMode: searchParams.get("testMode") === "true",
  };
}

/**
 * Render the top-level page container for the Swarm-Walk simulation.
 *
 * @returns Returns the full-size canvas page section.
 */
export function SwarmWalkPage() {
  const { isTestMode } = useMemo(() => resolvePageConfiguration(), []);
  const [testApi, setTestApi] = useState<SwarmWalkTestApi | null>(null);

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
        <SwarmWalkScene onTestApiReady={setTestApi} />
      </Canvas>
    </section>
  );
}
