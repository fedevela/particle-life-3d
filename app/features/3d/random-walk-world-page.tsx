import { Canvas } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { createRandomWalkToroidalPhysicsPort } from "~/features/3d/random-walk-world-physics-seam";
import { useUiStore } from "~/state/ui-store";
import type { RandomWalkWorldParams } from "~/types/random-walk-world";

/** Issue #32 architecture placement mapping: CH-001, CH-003. */
const ISSUE_32_RANDOM_WALK_PAGE_REQUIREMENTS = ["CH-001", "CH-003"] as const;

/**
 * Place the random-walk runtime surface in the 3D feature layer.
 */
export function RandomWalkWorldPage() {
  const params = useUiStore((state) => state.randomWalkWorldParams);

  void ISSUE_32_RANDOM_WALK_PAGE_REQUIREMENTS;

  return (
    <section className="h-full w-full">
      <Canvas camera={{ position: [0, 0, 6], fov: 55 }}>
        <ambientLight intensity={0.75} />
        <RandomWalkDotCloud params={params} />
      </Canvas>
    </section>
  );
}

function createInitialState(params: RandomWalkWorldParams) {
  const positions = new Float32Array(params.dotCount * 3);
  const velocities = new Float32Array(params.dotCount * 3);

  for (let index = 0; index < params.dotCount; index += 1) {
    const offset = index * 3;
    positions[offset] = (Math.random() * 2 - 1) * params.boundaryExtent;
    positions[offset + 1] = (Math.random() * 2 - 1) * params.boundaryExtent;
    positions[offset + 2] = (Math.random() * 2 - 1) * params.boundaryExtent;

    velocities[offset] = (Math.random() * 2 - 1) * params.stepScale;
    velocities[offset + 1] = (Math.random() * 2 - 1) * params.stepScale;
    velocities[offset + 2] = (Math.random() * 2 - 1) * params.stepScale;
  }

  return { positions, velocities };
}

type RandomWalkDotCloudProps = {
  params: RandomWalkWorldParams;
};

function RandomWalkDotCloud({ params }: RandomWalkDotCloudProps) {
  const physicsPort = useMemo(() => createRandomWalkToroidalPhysicsPort(), []);
  const simulationHandleRef = useRef<ReturnType<typeof physicsPort.initializeSimulation> | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const velocityRef = useRef<Float32Array>(new Float32Array(0));
  const state = useMemo(() => createInitialState(params), [params]);

  const boundary = useMemo(
    () => ({
      min: [-params.boundaryExtent, -params.boundaryExtent, -params.boundaryExtent] as const,
      max: [params.boundaryExtent, params.boundaryExtent, params.boundaryExtent] as const,
    }),
    [params.boundaryExtent],
  );

  useEffect(() => {
    velocityRef.current = state.velocities;
    simulationHandleRef.current?.dispose();
    simulationHandleRef.current = physicsPort.initializeSimulation(params);

    return () => {
      simulationHandleRef.current?.dispose();
      simulationHandleRef.current = null;
    };
  }, [params, physicsPort, state.velocities]);

  useFrame((_, delta) => {
    const geometry = geometryRef.current;
    if (!geometry) {
      return;
    }

    const positionAttribute = geometry.getAttribute("position");
    if (!(positionAttribute instanceof THREE.BufferAttribute)) {
      return;
    }

    const positions = positionAttribute.array as Float32Array;
    const velocities = velocityRef.current;
    const deltaScale = Math.min(delta * 60, 2);

    for (let index = 0; index < params.dotCount; index += 1) {
      const offset = index * 3;
      let vx = velocities[offset];
      let vy = velocities[offset + 1];
      let vz = velocities[offset + 2];

      vx += (Math.random() * 2 - 1) * params.stepScale * 0.15;
      vy += (Math.random() * 2 - 1) * params.stepScale * 0.15;
      vz += (Math.random() * 2 - 1) * params.stepScale * 0.15;

      const maxSpeed = params.stepScale * 3;
      const speed = Math.hypot(vx, vy, vz);
      if (speed > maxSpeed && speed > 0) {
        const ratio = maxSpeed / speed;
        vx *= ratio;
        vy *= ratio;
        vz *= ratio;
      }

      const transition = physicsPort.deriveToroidalWrapTransition(
        {
          position: [
            positions[offset] + vx * deltaScale,
            positions[offset + 1] + vy * deltaScale,
            positions[offset + 2] + vz * deltaScale,
          ],
          velocity: [vx, vy, vz],
        },
        boundary,
      );

      positions[offset] = transition.nextPosition[0];
      positions[offset + 1] = transition.nextPosition[1];
      positions[offset + 2] = transition.nextPosition[2];
      velocities[offset] = transition.preservedVelocity[0];
      velocities[offset + 1] = transition.preservedVelocity[1];
      velocities[offset + 2] = transition.preservedVelocity[2];
    }

    positionAttribute.needsUpdate = true;
  });

  return (
    <points>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" args={[state.positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#34d399" size={0.03} sizeAttenuation />
    </points>
  );
}
