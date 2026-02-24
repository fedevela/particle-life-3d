import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import fragmentShader from "~/features/3d/shaders/hello-shader-world.frag";
import vertexShader from "~/features/3d/shaders/hello-shader-world.vert";
import {
  HelloShaderWorldSimulation,
  SHADER_TEXTURE_SIZE,
} from "~/features/3d/hello-shader-world-simulation";
import { createLogger } from "~/lib/logger";

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
  return new THREE.BufferAttribute(new Float32Array(3), 3);
}

/** Create a UV reference per particle texel for shader texture lookup. */
function createReferenceAttribute() {
  const references = new Float32Array(2);
  references[0] = 0.5 / SHADER_TEXTURE_SIZE;
  references[1] = 0.5 / SHADER_TEXTURE_SIZE;

  return new THREE.BufferAttribute(references, 2);
}

export function HelloShaderWorldScene({ seed, onTestApiReady }: HelloShaderWorldSceneProps) {
  const { gl } = useThree();
  const simulationRef = useRef<HelloShaderWorldSimulation | null>(null);

  const [error, setError] = useState<Error | null>(null);

  const positionAttribute = useMemo(() => createPositionAttribute(), []);
  const referenceAttribute = useMemo(() => createReferenceAttribute(), []);

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
        uniforms.uState.value = simulation.getStateTexture();
      },
    });

    return () => {
      onTestApiReady(null);
    };
  }, [onTestApiReady, uniforms]);

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
        </bufferGeometry>
        <shaderMaterial vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} />
      </points>
      <OrbitControls />
    </>
  );
}
