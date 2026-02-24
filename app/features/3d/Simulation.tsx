import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";
import * as THREE from "three";

import { persistSimulationSnapshot } from "~/db/client-bridge/bridge";
import renderFragmentShader from "~/features/3d/shaders/render.frag";
import renderVertexShader from "~/features/3d/shaders/render.vert";
import simulationFragmentShader from "~/features/3d/shaders/simulation.frag";
import { useSimulationMilestoneStore } from "~/state/simulation-milestone-store";

type SimulationMilestone = {
  milestoneId: string;
  frame: number;
};

type PendingSnapshot = {
  milestoneId: string;
  frame: number;
};

type PositionVariable = {
  material: THREE.ShaderMaterial;
};

type SimulationRuntime = {
  gpu: GPUComputationRenderer;
  positionVariable: PositionVariable;
  copyMaterial: THREE.ShaderMaterial;
  stagingTargets: Map<string, THREE.WebGLRenderTarget>;
  milestonesByFrame: Map<number, SimulationMilestone[]>;
};

type SimulationProps = {
  projectId: string;
  seed: string;
  milestones: SimulationMilestone[];
};

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 1000000) / 1000000;
}

function quantizeToSixDecimals(value: number) {
  return Number(value.toFixed(6));
}

function createPositionAttribute() {
  return new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3);
}

function createReferenceAttribute() {
  return new THREE.BufferAttribute(new Float32Array([0.5, 0.5]), 2);
}

function createMilestonesByFrame(milestones: SimulationMilestone[]) {
  const milestonesByFrame = new Map<number, SimulationMilestone[]>();

  for (const milestone of milestones) {
    const existing = milestonesByFrame.get(milestone.frame) ?? [];
    existing.push(milestone);
    milestonesByFrame.set(milestone.frame, existing);
  }

  return milestonesByFrame;
}

function createCopyShaderSource() {
  return "uniform sampler2D uTexture; void main() { vec2 uv = gl_FragCoord.xy / resolution.xy; gl_FragColor = texture2D(uTexture, uv); }";
}

function initializeSeededTexture(texture: THREE.DataTexture, seedValue: number) {
  const data = texture.image.data as Float32Array;
  const initialX = quantizeToSixDecimals((seedValue - 0.5) * 0.6);
  const initialY = quantizeToSixDecimals((0.5 - seedValue) * 0.35);
  const initialZ = quantizeToSixDecimals((seedValue - 0.5) * 0.2);
  data[0] = initialX;
  data[1] = initialY;
  data[2] = initialZ;
  data[3] = 0;
}

function createSimulationRuntime(
  renderer: THREE.WebGLRenderer,
  seed: string,
  milestones: SimulationMilestone[],
) {
  const seedValue = hashSeed(seed);
  const gpu = new GPUComputationRenderer(1, 1, renderer);
  const initialTexture = gpu.createTexture();
  initializeSeededTexture(initialTexture, seedValue);

  const positionVariable = gpu.addVariable(
    "texturePosition",
    simulationFragmentShader,
    initialTexture,
  ) as unknown as PositionVariable;
  gpu.setVariableDependencies(positionVariable as never, [positionVariable as never]);
  positionVariable.material.uniforms.uSeed = { value: seedValue };
  positionVariable.material.uniforms.uStep = { value: 1 };

  const copyMaterial = gpu.createShaderMaterial(createCopyShaderSource(), {
    uTexture: { value: null },
  }) as THREE.ShaderMaterial;

  const initError = gpu.init();
  if (initError !== null) {
    throw new Error(initError);
  }

  const stagingTargets = new Map<string, THREE.WebGLRenderTarget>();
  for (const milestone of milestones) {
    stagingTargets.set(
      milestone.milestoneId,
      gpu.createRenderTarget(
        1,
        1,
        THREE.ClampToEdgeWrapping,
        THREE.ClampToEdgeWrapping,
        THREE.NearestFilter,
        THREE.NearestFilter,
      ),
    );
  }

  return {
    gpu,
    positionVariable,
    copyMaterial,
    stagingTargets,
    milestonesByFrame: createMilestonesByFrame(milestones),
  };
}

function disposeSimulationRuntime(runtime: SimulationRuntime) {
  runtime.copyMaterial.dispose();
  for (const renderTarget of runtime.stagingTargets.values()) {
    renderTarget.dispose();
  }
}

export function Simulation({ projectId, seed, milestones }: SimulationProps) {
  const { gl } = useThree();
  const shaderMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const runtimeRef = useRef<SimulationRuntime | null>(null);
  const currentFrameRef = useRef(0);
  const capturedMilestonesRef = useRef(new Set<string>());
  const pendingSnapshotsRef = useRef<PendingSnapshot[]>([]);
  const isPersistingRef = useRef(false);

  const positionAttribute = useMemo(() => createPositionAttribute(), []);
  const referenceAttribute = useMemo(() => createReferenceAttribute(), []);

  useEffect(() => {
    useSimulationMilestoneStore.getState().reset();
    currentFrameRef.current = 0;
    capturedMilestonesRef.current.clear();
    pendingSnapshotsRef.current = [];
    runtimeRef.current = createSimulationRuntime(gl, seed, milestones);

    return () => {
      if (runtimeRef.current !== null) {
        disposeSimulationRuntime(runtimeRef.current);
      }

      runtimeRef.current = null;
      useSimulationMilestoneStore.getState().reset();
    };
  }, [gl, milestones, seed]);

  useEffect(() => {
    function processOneSnapshot() {
      if (isPersistingRef.current) {
        return;
      }

      const runtime = runtimeRef.current;
      if (runtime === null) {
        return;
      }

      const nextSnapshot = pendingSnapshotsRef.current.shift() ?? null;
      if (nextSnapshot === null) {
        useSimulationMilestoneStore.getState().setSyncing(false);
        return;
      }

      const stagingTarget = runtime.stagingTargets.get(nextSnapshot.milestoneId) ?? null;
      if (stagingTarget === null) {
        return;
      }

      isPersistingRef.current = true;
      useSimulationMilestoneStore.getState().setSyncing(true);

      const pixelBuffer = new Float32Array(4);
      gl.readRenderTargetPixels(stagingTarget, 0, 0, 1, 1, pixelBuffer);

      const payload: [number, number, number] = [
        quantizeToSixDecimals(pixelBuffer[0]),
        quantizeToSixDecimals(pixelBuffer[1]),
        quantizeToSixDecimals(pixelBuffer[2]),
      ];

      void persistSimulationSnapshot(
        {
          milestoneId: nextSnapshot.milestoneId,
          frame: nextSnapshot.frame,
          payload,
        },
        projectId,
      )
        .then(() => {
          useSimulationMilestoneStore
            .getState()
            .setLastSavedMilestone(nextSnapshot.milestoneId, nextSnapshot.frame);
        })
        .finally(() => {
          isPersistingRef.current = false;
          useSimulationMilestoneStore
            .getState()
            .setSyncing(pendingSnapshotsRef.current.length > 0 || isPersistingRef.current);
        });
    }

    const intervalId = window.setInterval(processOneSnapshot, 50);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [gl, projectId]);

  useFrame(() => {
    const runtime = runtimeRef.current;
    if (runtime === null) {
      return;
    }

    runtime.gpu.compute();
    currentFrameRef.current += 1;
    useSimulationMilestoneStore.getState().setCurrentFrame(currentFrameRef.current);

    const currentTexture = runtime.gpu.getCurrentRenderTarget(runtime.positionVariable as never).texture;
    if (shaderMaterialRef.current !== null) {
      shaderMaterialRef.current.uniforms.uPositions.value = currentTexture;
    }

    const milestonesAtFrame = runtime.milestonesByFrame.get(currentFrameRef.current) ?? [];
    if (milestonesAtFrame.length === 0) {
      return;
    }

    for (const milestone of milestonesAtFrame) {
      if (capturedMilestonesRef.current.has(milestone.milestoneId)) {
        continue;
      }

      const stagingTarget = runtime.stagingTargets.get(milestone.milestoneId);
      if (!stagingTarget) {
        continue;
      }

      runtime.copyMaterial.uniforms.uTexture.value = currentTexture;
      runtime.gpu.doRenderTarget(runtime.copyMaterial, stagingTarget);
      pendingSnapshotsRef.current.push({
        milestoneId: milestone.milestoneId,
        frame: milestone.frame,
      });
      capturedMilestonesRef.current.add(milestone.milestoneId);
      useSimulationMilestoneStore.getState().setSyncing(true);
    }
  });

  return (
    <points>
      <bufferGeometry>
        <primitive attach="attributes-position" object={positionAttribute} />
        <primitive attach="attributes-reference" object={referenceAttribute} />
      </bufferGeometry>
      <shaderMaterial
        ref={shaderMaterialRef}
        vertexShader={renderVertexShader}
        fragmentShader={renderFragmentShader}
        transparent
        depthWrite={false}
        uniforms={{
          uPositions: { value: null },
          uColor: { value: new THREE.Color("#f59e0b") },
        }}
      />
    </points>
  );
}
