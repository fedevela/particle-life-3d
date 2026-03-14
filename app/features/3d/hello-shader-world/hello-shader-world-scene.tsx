import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import fragmentShader from "~/features/3d/hello-shader-world/shaders/hello-shader-world.frag";
import vertexShader from "~/features/3d/hello-shader-world/shaders/hello-shader-world.vert";
import {
  HelloShaderWorldSimulation,
  SHADER_PARTICLE_CAPACITY,
  SHADER_TEXTURE_SIZE,
} from "~/features/3d/hello-shader-world/hello-shader-world-simulation";
import { createLogger } from "~/lib/logger";
import { useUiStore } from "~/state/ui-store";

/** Provide scoped logs for shader scene stepping and milestone publication. */
const logger = createLogger("hello-shader-world-scene");

/** Define test-only APIs exposed from this scene to the route page wrapper. */
export type ShaderContractTestHarnessApi = {
  getCurrentFrame: () => number;
  getShaderContractText: (frame?: number) => string;
  resetSimulation: () => void;
};

/** Define scene props used by runtime/test wiring. */
type HelloShaderWorldSceneProps = {
  seed: string;
  onTestApiReady?: (api: ShaderContractTestHarnessApi | null) => void;
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
  const activeParticleMask = new Float32Array(SHADER_PARTICLE_CAPACITY);
  activeParticleMask[0] = 1;
  return new THREE.BufferAttribute(activeParticleMask, 1);
}

export function HelloShaderWorldScene({ seed, onTestApiReady }: HelloShaderWorldSceneProps) {
  const { gl } = useThree();
  const supportsVertexTextureSampling = gl.capabilities.maxVertexTextures > 0;
  const shaderSimulationRef = useRef<HelloShaderWorldSimulation | null>(null);
  const helloShaderWorldActionQueue = useUiStore((state) => state.helloShaderWorldActionQueue);
  const dequeueHelloShaderWorldAction = useUiStore((state) => state.dequeueHelloShaderWorldAction);
  const movementParams = useUiStore((state) => state.helloShaderWorldMovementParams);

  const [error, setError] = useState<Error | null>(null);
  const [isShaderSimulationReady, setIsShaderSimulationReady] = useState(false);

  const particlePositionAttribute = useMemo(() => createPositionAttribute(), []);
  const particleReferenceAttribute = useMemo(() => createReferenceAttribute(), []);
  const activeParticleAttribute = useMemo(() => createActiveAttribute(), []);

  const particleRenderUniforms = useMemo(
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
      const initializedSimulation = new HelloShaderWorldSimulation(gl, seed);
      initializedSimulation.setMovementParams(movementParams);
      shaderSimulationRef.current = initializedSimulation;
      particleRenderUniforms.uState.value = initializedSimulation.getStateTexture();
      setIsShaderSimulationReady(true);
    } catch (initializationError: unknown) {
      setError(
        initializationError instanceof Error
          ? initializationError
          : new Error("Failed to initialize hello-shader-world simulation."),
      );
    }

    return () => {
      shaderSimulationRef.current?.dispose();
      shaderSimulationRef.current = null;
      particleRenderUniforms.uState.value = null;
      setIsShaderSimulationReady(false);
    };
  }, [gl, particleRenderUniforms, seed]);

  useEffect(() => {
    const shaderSimulation = shaderSimulationRef.current;
    if (!shaderSimulation) {
      return;
    }

    shaderSimulation.setMovementParams(movementParams);
  }, [movementParams]);

  useEffect(() => {
    if (!onTestApiReady || !isShaderSimulationReady) {
      return;
    }

    onTestApiReady({
      getCurrentFrame: () => shaderSimulationRef.current?.getCurrentFrame() ?? 0,
      getShaderContractText: (frame) => {
        const shaderSimulation = shaderSimulationRef.current;
        if (!shaderSimulation) {
          throw new Error("Shader simulation is not ready yet.");
        }

        return shaderSimulation.getShaderContractText(frame);
      },
      resetSimulation: () => {
        const shaderSimulation = shaderSimulationRef.current;
        if (!shaderSimulation) {
          throw new Error("Shader simulation is not ready yet.");
        }

        shaderSimulation.reset();
        activeParticleAttribute.array.fill(0);
        activeParticleAttribute.array[0] = 1;
        activeParticleAttribute.needsUpdate = true;
        particleRenderUniforms.uState.value = shaderSimulation.getStateTexture();
      },
    });

    return () => {
      onTestApiReady(null);
    };
  }, [activeParticleAttribute, isShaderSimulationReady, onTestApiReady, particleRenderUniforms]);

  useEffect(() => {
    const shaderSimulation = shaderSimulationRef.current;
    const pendingParticleAction = helloShaderWorldActionQueue[0];
    if (!isShaderSimulationReady || !shaderSimulation || !pendingParticleAction) {
      return;
    }

    if (pendingParticleAction.type === "add") {
      const addedParticleIds = shaderSimulation.addParticles(pendingParticleAction.amount);
      for (const particleId of addedParticleIds) {
        activeParticleAttribute.array[particleId] = 1;
      }
      activeParticleAttribute.needsUpdate = true;
    } else {
      const removedParticleIds = shaderSimulation.removeParticles(pendingParticleAction.amount);
      for (const particleId of removedParticleIds) {
        activeParticleAttribute.array[particleId] = 0;
      }
      activeParticleAttribute.needsUpdate = true;
    }

    particleRenderUniforms.uState.value = shaderSimulation.getStateTexture();
    dequeueHelloShaderWorldAction();
  }, [
    activeParticleAttribute,
    dequeueHelloShaderWorldAction,
    helloShaderWorldActionQueue,
    isShaderSimulationReady,
    particleRenderUniforms,
  ]);

  useFrame(() => {
    const shaderSimulation = shaderSimulationRef.current;
    if (!shaderSimulation) {
      return;
    }

    const publishedMilestone = shaderSimulation.step();
    particleRenderUniforms.uState.value = shaderSimulation.getStateTexture();

    if (publishedMilestone) {
      logger.debug("Publish shader milestone.", { frame: publishedMilestone.frame });
    }
  });

  return (
    <>
      <gridHelper args={[12, 12, "#d97706", "#1f2937"]} />
      {supportsVertexTextureSampling ? (
        <points>
          <bufferGeometry>
            <primitive attach="attributes-position" object={particlePositionAttribute} />
            <primitive attach="attributes-aReference" object={particleReferenceAttribute} />
            <primitive attach="attributes-aActive" object={activeParticleAttribute} />
          </bufferGeometry>
          <shaderMaterial
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            uniforms={particleRenderUniforms}
          />
        </points>
      ) : null}
      <OrbitControls />
    </>
  );
}
