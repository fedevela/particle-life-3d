import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { RandomWalkWorldSimulation } from "~/features/3d/random-walk-world/random-walk-world-simulation";
import { resolveRandomWalkSeed } from "~/features/3d/random-walk-world/simulation/random-walk-parameter-runtime";
import { useUiStore } from "~/state/ui-store";
import type { RandomWalkWorldPhysicsParams, RandomWalkWorldParams } from "~/types/random-walk-world";

const RANDOM_WALK_FRAME_DURATION_MS = 1000 / 60;
const MAX_STEPS_PER_RENDER = 5;

declare global {
  interface Window {
    __GET_RANDOM_WALK_FRAME__?: () => number;
    __GET_RANDOM_WALK_CONTRACT_TEXT__?: (timeMs?: number) => string;
    __RESET_RANDOM_WALK_SIM_FOR_TEST__?: () => void;
    __GET_RANDOM_WALK_CAMERA_STATE__?: () => {
      position: readonly [number, number, number];
      target: readonly [number, number, number];
    };
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
  const sessionSeedRef = useRef(seed ?? crypto.randomUUID());
  const orbitControlsRef = useRef<OrbitControlsImpl | null>(null);
  const seedPlan = resolveRandomWalkSeed({
    querySeed: seed,
    sessionSeed: sessionSeedRef.current,
    uiSeedInput: seedInput,
  });
  const resolvedSeed = seedPlan.effectiveSeed;

  return (
    <section className="h-full w-full">
      <Canvas camera={{ position: [0, 0, 6], fov: 55 }}>
        <color attach="background" args={["#020617"]} />
        <ambientLight intensity={0.75} />
        <gridHelper args={[18, 18, "#164e63", "#0f172a"]} />
        <RandomWalkDotCloud params={params} physicsParams={physicsParams} seed={resolvedSeed} isTestMode={isTestMode} />
        <OrbitControls
          ref={orbitControlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
        />
        <RandomWalkCameraTestApi isTestMode={isTestMode} orbitControlsRef={orbitControlsRef} />
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

type RandomWalkCameraTestApiProps = {
  isTestMode: boolean;
  orbitControlsRef: RefObject<OrbitControlsImpl | null>;
};

function RandomWalkCameraTestApi({ isTestMode, orbitControlsRef }: RandomWalkCameraTestApiProps) {
  useEffect(() => {
    if (!isTestMode) {
      return;
    }

    window.__GET_RANDOM_WALK_CAMERA_STATE__ = () => {
      const controls = orbitControlsRef.current;
      if (!controls) {
        return {
          position: [0, 0, 0] as const,
          target: [0, 0, 0] as const,
        };
      }

      return {
        position: [controls.object.position.x, controls.object.position.y, controls.object.position.z] as const,
        target: [controls.target.x, controls.target.y, controls.target.z] as const,
      };
    };

    return () => {
      delete window.__GET_RANDOM_WALK_CAMERA_STATE__;
    };
  }, [isTestMode, orbitControlsRef]);

  return null;
}

function RandomWalkDotCloud({ params, physicsParams, seed, isTestMode }: RandomWalkDotCloudProps) {
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const simulationRef = useRef<RandomWalkWorldSimulation | null>(null);
  const frameAccumulatorMsRef = useRef(0);
  const simulation = useMemo(
    () => new RandomWalkWorldSimulation(params, seed, isTestMode, physicsParams),
    [params, seed, isTestMode],
  );
  simulationRef.current = simulation;

  useEffect(() => {
    frameAccumulatorMsRef.current = 0;
  }, [simulation]);

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

  useFrame((_, deltaSeconds) => {
    const geometry = geometryRef.current;
    if (!geometry) {
      return;
    }

    const positionAttribute = geometry.getAttribute("position");
    if (!(positionAttribute instanceof THREE.BufferAttribute)) {
      return;
    }

    frameAccumulatorMsRef.current += Math.min(deltaSeconds * 1000, RANDOM_WALK_FRAME_DURATION_MS * MAX_STEPS_PER_RENDER);
    let stepped = false;
    let steps = 0;
    while (
      frameAccumulatorMsRef.current >= RANDOM_WALK_FRAME_DURATION_MS &&
      steps < MAX_STEPS_PER_RENDER
    ) {
      simulation.stepFrame();
      frameAccumulatorMsRef.current -= RANDOM_WALK_FRAME_DURATION_MS;
      steps += 1;
      stepped = true;
    }

    if (stepped) {
      positionAttribute.needsUpdate = true;
    }
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
