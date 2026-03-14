import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { RandomWalkWorldSimulation } from "~/features/3d/random-walk-world-simulation";
import { useUiStore } from "~/state/ui-store";
import type { RandomWalkWorldParams } from "~/types/random-walk-world";

/** Issue #32 architecture placement mapping: CH-001, CH-003. */
const ISSUE_32_RANDOM_WALK_PAGE_REQUIREMENTS = ["CH-001", "CH-003"] as const;

declare global {
  interface Window {
    __GET_RANDOM_WALK_FRAME__?: () => number;
    __GET_RANDOM_WALK_CONTRACT_TEXT__?: (timeMs?: number) => string;
    __RESET_RANDOM_WALK_SIM_FOR_TEST__?: () => void;
  }
}

function resolveRandomWalkPageConfiguration() {
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
 * Place the random-walk runtime surface in the 3D feature layer.
 */
export function RandomWalkWorldPage() {
  const params = useUiStore((state) => state.randomWalkWorldParams);
  const { isTestMode, seed } = useMemo(() => resolveRandomWalkPageConfiguration(), []);
  const sessionSeedRef = useRef(seed ?? crypto.randomUUID());
  const resolvedSeed = seed ?? sessionSeedRef.current;

  void ISSUE_32_RANDOM_WALK_PAGE_REQUIREMENTS;

  return (
    <section className="h-full w-full">
      <Canvas camera={{ position: [0, 0, 6], fov: 55 }}>
        <color attach="background" args={["#020617"]} />
        <ambientLight intensity={0.75} />
        <gridHelper args={[18, 18, "#164e63", "#0f172a"]} />
        <RandomWalkDotCloud params={params} seed={resolvedSeed} isTestMode={isTestMode} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      </Canvas>
    </section>
  );
}

type RandomWalkDotCloudProps = {
  params: RandomWalkWorldParams;
  seed: string;
  isTestMode: boolean;
};

function RandomWalkDotCloud({ params, seed, isTestMode }: RandomWalkDotCloudProps) {
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const simulation = useMemo(
    () => new RandomWalkWorldSimulation(params, seed, isTestMode),
    [params, seed, isTestMode],
  );

  useEffect(() => {
    if (!isTestMode) {
      return;
    }

    window.__GET_RANDOM_WALK_FRAME__ = () => simulation.getFrame();
    window.__GET_RANDOM_WALK_CONTRACT_TEXT__ = (timeMs) => {
      if (typeof timeMs === "number") {
        return simulation.getContractTextAtTimeMs(timeMs);
      }

      return simulation.getContractTextAtFrame(simulation.getFrame());
    };
    window.__RESET_RANDOM_WALK_SIM_FOR_TEST__ = () => {
      simulation.reset();
    };

    return () => {
      delete window.__GET_RANDOM_WALK_FRAME__;
      delete window.__GET_RANDOM_WALK_CONTRACT_TEXT__;
      delete window.__RESET_RANDOM_WALK_SIM_FOR_TEST__;
    };
  }, [isTestMode, simulation]);

  useFrame(() => {
    const geometry = geometryRef.current;
    if (!geometry) {
      return;
    }

    const positionAttribute = geometry.getAttribute("position");
    if (!(positionAttribute instanceof THREE.BufferAttribute)) {
      return;
    }

    simulation.stepFrame();
    positionAttribute.needsUpdate = true;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" args={[simulation.getPositions(), 3]} />
      </bufferGeometry>
      <pointsMaterial color="#34d399" size={0.07} sizeAttenuation depthWrite={false} />
    </points>
  );
}
