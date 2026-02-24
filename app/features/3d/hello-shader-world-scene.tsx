import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import fragmentShader from "~/features/3d/shaders/hello-shader-world.frag";
import vertexShader from "~/features/3d/shaders/hello-shader-world.vert";
import {
  HelloShaderWorldSimulation,
  SHADER_PARTICLE_CAPACITY,
  SHADER_TEXTURE_SIZE,
} from "~/features/3d/hello-shader-world-simulation";
import { createLogger } from "~/lib/logger";
import { useUiStore } from "~/state/ui-store";

/** Provide scoped logs for shader scene stepping and milestone publication. */
const logger = createLogger("hello-shader-world-scene");

/** Define test-only APIs exposed from this scene to the route page wrapper. */
export type ShaderWorldTestApi = {
  getCurrentFrame: () => number;
  getShaderContractText: (frame?: number) => string;
  resetSimulation: () => void;
};

/** Define scene props used by runtime/test wiring. */
type HelloShaderWorldSceneProps = {
  seed: string;
  onTestApiReady?: (api: ShaderWorldTestApi | null) => void;
};

/** Create the static position attribute expected by Three Points geometry. */
function createPositionAttribute() {
  return new THREE.BufferAttribute(new Float32Array(SHADER_PARTICLE_CAPACITY * 3), 3);
}

/** Create a UV reference per particle texel for shader texture lookup. */
function createReferenceAttribute() {
  const references = new Float32Array(SHADER_PARTICLE_CAPACITY * 2);
  for (let index = 0; index < SHADER_PARTICLE_CAPACITY; index += 1) {
    const x = index % SHADER_TEXTURE_SIZE;
    const y = Math.floor(index / SHADER_TEXTURE_SIZE);
    const offset = index * 2;
    references[offset] = (x + 0.5) / SHADER_TEXTURE_SIZE;
    references[offset + 1] = (y + 0.5) / SHADER_TEXTURE_SIZE;
  }

  return new THREE.BufferAttribute(references, 2);
}

function createActiveAttribute() {
  const active = new Float32Array(SHADER_PARTICLE_CAPACITY);
  active[0] = 1;
  return new THREE.BufferAttribute(active, 1);
}

export function HelloShaderWorldScene({ seed, onTestApiReady }: HelloShaderWorldSceneProps) {
  const { gl } = useThree();
  const simulationRef = useRef<HelloShaderWorldSimulation | null>(null);
  const helloShaderWorldActionQueue = useUiStore((state) => state.helloShaderWorldActionQueue);
  const dequeueHelloShaderWorldAction = useUiStore((state) => state.dequeueHelloShaderWorldAction);

  const [error, setError] = useState<Error | null>(null);
  const [isSimulationReady, setIsSimulationReady] = useState(false);

  const positionAttribute = useMemo(() => createPositionAttribute(), []);
  const referenceAttribute = useMemo(() => createReferenceAttribute(), []);
  const activeAttribute = useMemo(() => createActiveAttribute(), []);

  const uniforms = useMemo(
    () => ({
      uState: { value: null as THREE.Texture | null },
      uColorA: { value: new THREE.Color("#22d3ee") },
    }),
    [],
  );

  if (error) {
    throw error;
  }

  useEffect(() => {
    try {
      const simulation = new HelloShaderWorldSimulation(gl, seed);
      simulationRef.current = simulation;
      uniforms.uState.value = simulation.getStateTexture();
      setIsSimulationReady(true);
    } catch (initializationError: unknown) {
      setError(
        initializationError instanceof Error
          ? initializationError
          : new Error("Failed to initialize hello-shader-world simulation."),
      );
    }

    return () => {
      simulationRef.current?.dispose();
      simulationRef.current = null;
      uniforms.uState.value = null;
      setIsSimulationReady(false);
    };
  }, [gl, seed, uniforms]);

  useEffect(() => {
    if (!onTestApiReady) {
      return;
    }

    onTestApiReady({
      getCurrentFrame: () => simulationRef.current?.getCurrentFrame() ?? 0,
      getShaderContractText: (frame) => {
        const simulation = simulationRef.current;
        if (!simulation) {
          throw new Error("Shader simulation is not ready yet.");
        }

        return simulation.getShaderContractText(frame);
      },
      resetSimulation: () => {
        const simulation = simulationRef.current;
        if (!simulation) {
          throw new Error("Shader simulation is not ready yet.");
        }

        simulation.reset();
        activeAttribute.array.fill(0);
        activeAttribute.array[0] = 1;
        activeAttribute.needsUpdate = true;
        uniforms.uState.value = simulation.getStateTexture();
      },
    });

    return () => {
      onTestApiReady(null);
    };
  }, [activeAttribute, onTestApiReady, uniforms]);

  useEffect(() => {
    const simulation = simulationRef.current;
    const pendingAction = helloShaderWorldActionQueue[0];
    if (!isSimulationReady || !simulation || !pendingAction) {
      return;
    }

    if (pendingAction.type === "add") {
      const addedIndexes = simulation.addParticles(pendingAction.amount);
      for (const index of addedIndexes) {
        activeAttribute.array[index] = 1;
      }
      activeAttribute.needsUpdate = true;
    } else {
      const removedIndexes = simulation.removeParticles(pendingAction.amount);
      for (const index of removedIndexes) {
        activeAttribute.array[index] = 0;
      }
      activeAttribute.needsUpdate = true;
    }

    uniforms.uState.value = simulation.getStateTexture();
    dequeueHelloShaderWorldAction();
  }, [activeAttribute, dequeueHelloShaderWorldAction, helloShaderWorldActionQueue, isSimulationReady, uniforms]);

  useFrame(() => {
    const simulation = simulationRef.current;
    if (!simulation) {
      return;
    }

    const milestone = simulation.step();
    uniforms.uState.value = simulation.getStateTexture();

    if (milestone) {
      logger.debug("Publish shader milestone.", { frame: milestone.frame });
    }
  });

  return (
    <>
      <gridHelper args={[12, 12, "#d97706", "#1f2937"]} />
      <points>
        <bufferGeometry>
          <primitive attach="attributes-position" object={positionAttribute} />
          <primitive attach="attributes-aReference" object={referenceAttribute} />
          <primitive attach="attributes-aActive" object={activeAttribute} />
        </bufferGeometry>
        <shaderMaterial vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} />
      </points>
      <OrbitControls />
    </>
  );
}
