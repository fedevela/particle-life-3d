import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { createRandomWalkWorldParameterControlsArchitecturePort } from "~/features/3d/random-walk-world/random-walk-world-parameter-controls.architecture";
import { RandomWalkWorldSimulation } from "~/features/3d/random-walk-world/random-walk-world-simulation";
import { useUiStore } from "~/state/ui-store";
import type { RandomWalkWorldPhysicsParams, RandomWalkWorldParams } from "~/types/random-walk-world";

/** Issue #32 architecture placement mapping: CH-001, CH-003. */
const ISSUE_32_RANDOM_WALK_PAGE_REQUIREMENTS = ["CH-001", "CH-003"] as const;
/** Issue #33 architecture placement mapping: CH-004, CH-005, CH-005-A, CH-008. */
const ISSUE_33_RANDOM_WALK_PAGE_REQUIREMENTS = ["CH-004", "CH-005", "CH-005-A", "CH-008"] as const;
/** Issue #34 architecture placement mapping: CH-002, CH-006, CH-007, CH-009, CH-010. */
const ISSUE_34_RANDOM_WALK_PAGE_REQUIREMENTS = ["CH-002", "CH-006", "CH-007", "CH-009", "CH-010"] as const;

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
  const physicsParams = useUiStore((state) => state.randomWalkWorldPhysicsParams);
  const seedInput = useUiStore((state) => state.randomWalkWorldSeedInput);
  const { isTestMode, seed } = useMemo(() => resolveRandomWalkPageConfiguration(), []);
  const parameterControlsPort = useMemo(() => createRandomWalkWorldParameterControlsArchitecturePort(), []);
  const sessionSeedRef = useRef(seed ?? crypto.randomUUID());
  const seedPlan = parameterControlsPort.deriveSeedControlPlan({
    querySeed: seed,
    sessionSeed: sessionSeedRef.current,
    uiSeedInput: seedInput,
  });
  const cameraContinuityPlan = parameterControlsPort.deriveCameraContinuityPlan({
    controlsBoundBeforeEdit: ["orbit", "pan", "zoom", "touch", "drag"],
    controlsBoundAfterEdit: ["orbit", "pan", "zoom", "touch", "drag"],
    userCameraMoveDetected: false,
  });
  const resolvedSeed = seedPlan.effectiveSeed;

  void ISSUE_32_RANDOM_WALK_PAGE_REQUIREMENTS;
  void ISSUE_33_RANDOM_WALK_PAGE_REQUIREMENTS;
  void ISSUE_34_RANDOM_WALK_PAGE_REQUIREMENTS;

  return (
    <section className="h-full w-full">
      <Canvas camera={{ position: [0, 0, 6], fov: 55 }}>
        <color attach="background" args={["#020617"]} />
        <ambientLight intensity={0.75} />
        <gridHelper args={[18, 18, "#164e63", "#0f172a"]} />
        <RandomWalkDotCloud params={params} physicsParams={physicsParams} seed={resolvedSeed} isTestMode={isTestMode} />
        <OrbitControls
          makeDefault
          enableDamping={cameraContinuityPlan.preserveDefaultOrbitBindings}
          dampingFactor={0.08}
        />
      </Canvas>
    </section>
  );
}

type RandomWalkDotCloudProps = {
  params: RandomWalkWorldParams;
  physicsParams: RandomWalkWorldPhysicsParams;
  seed: string;
  isTestMode: boolean;
};

function RandomWalkDotCloud({ params, physicsParams, seed, isTestMode }: RandomWalkDotCloudProps) {
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const simulationRef = useRef<RandomWalkWorldSimulation | null>(null);
  const simulation = useMemo(
    () => new RandomWalkWorldSimulation(params, seed, isTestMode, physicsParams),
    [params, seed, isTestMode],
  );
  simulationRef.current = simulation;

  useEffect(() => {
    simulationRef.current?.setPhysicsParams(physicsParams);
  }, [physicsParams]);

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
