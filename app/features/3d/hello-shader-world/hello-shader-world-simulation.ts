import { GPUComputationRenderer, type Variable } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import * as THREE from "three";

import computeShader from "~/features/3d/hello-shader-world/shaders/hello-shader-world.compute.frag";
import { getShaderContractText } from "~/features/3d/hello-shader-world/hello-shader-world-contract";
import { createLogger } from "~/lib/logger";
import {
  clampHelloShaderWorldMovementParams,
  DEFAULT_HELLO_SHADER_WORLD_MOVEMENT_PARAMS,
  type HelloShaderWorldMovementParams,
} from "~/types/hello-shader-world-movement";

/** Define the square texture size used by GPU simulation state. */
export const SHADER_TEXTURE_SIZE = 32;
export const SHADER_PARTICLE_CAPACITY = SHADER_TEXTURE_SIZE * SHADER_TEXTURE_SIZE;
/** Define exact frame numbers where the shader publishes milestone contracts. */
export const SHADER_MILESTONE_FRAMES = [0, 30, 60, 90] as const;
/** Define a fixed simulation timestep used for deterministic frame progression. */
const FIXED_TIME_STEP_SECONDS = 1 / 60;
const TAU = Math.PI * 2;
const FNV1A_32_OFFSET_BASIS = 2166136261;
const FNV1A_32_PRIME = 16777619;
/** Provide scoped logs for shader simulation lifecycle and milestones. */
const logger = createLogger("hello-shader-world-simulation");

/** Define milestone payload returned when one configured frame is reached. */
export type ShaderMilestone = {
  frame: number;
  contractText: string;
};

/**
 * Manage GPU simulation stepping and milestone contract capture.
 *
 * This class keeps shader-state reporting in-memory for E2E harness usage.
 */
export class HelloShaderWorldSimulation {
  /** Hold WebGL renderer used for compute and readback. */
  private readonly renderer: THREE.WebGLRenderer;

  /** Hold the GPU compute helper and state variable once initialized. */
  private readonly gpuComputationRenderer: GPUComputationRenderer;
  private readonly simulationStateVariable: Variable;

  /** Keep current simulation frame + elapsed time progression. */
  private currentSimulationFrame = 0;
  private elapsedSimulationSeconds = 0;
  private readonly deterministicSeedText: string;
  private readonly shaderSeedUniformValue: number;
  private deterministicRngState: number;
  private movementParams: HelloShaderWorldMovementParams = DEFAULT_HELLO_SHADER_WORLD_MOVEMENT_PARAMS;

  /** Store published contracts by exact milestone frame number. */
  private readonly milestoneContractByFrame = new Map<number, string>();

  /** Reuse one readback buffer to avoid allocations during milestone snapshots. */
  private readonly gpuStateReadbackBuffer = new Float32Array(SHADER_PARTICLE_CAPACITY * 4);
  private readonly gpuStateStagingTexture: THREE.DataTexture;

  /** Keep active particle indexes to support deterministic add/remove operations. */
  private readonly activeParticleIds: number[] = [];
  private readonly activeParticleLookupById = new Int32Array(SHADER_PARTICLE_CAPACITY).fill(-1);

  /** Initialize GPU simulation resources and seed frame 0 state. */
  constructor(renderer: THREE.WebGLRenderer, seed: string) {
    this.renderer = renderer;
    this.deterministicSeedText = seed;
    this.shaderSeedUniformValue = this.deriveNormalizedSeedUniform(seed);
    this.deterministicRngState = this.deriveSeedUint32(seed);
    this.gpuComputationRenderer = new GPUComputationRenderer(SHADER_TEXTURE_SIZE, SHADER_TEXTURE_SIZE, this.renderer);

    const initialStateTexture = this.gpuComputationRenderer.createTexture();
    this.gpuStateStagingTexture = this.gpuComputationRenderer.createTexture();
    const initialTextureData = initialStateTexture.image.data;
    if (!(initialTextureData instanceof Float32Array)) {
      throw new Error("Expected GPU initial texture data to be a Float32Array.");
    }

    this.writeInitialSimulationState(initialTextureData);

    const simulationStateVariable = this.gpuComputationRenderer.addVariable(
      "textureState",
      computeShader,
      initialStateTexture,
    );
    this.gpuComputationRenderer.setVariableDependencies(simulationStateVariable, [simulationStateVariable]);
    simulationStateVariable.material.uniforms.uFrame = { value: 0 };
    simulationStateVariable.material.uniforms.uSeed = { value: this.shaderSeedUniformValue };
    simulationStateVariable.material.uniforms.uAcceleration = { value: 0 };
    simulationStateVariable.material.uniforms.uDirectionJitter = { value: 0 };
    simulationStateVariable.material.uniforms.uMagnitudeJitter = { value: 0 };
    simulationStateVariable.material.uniforms.uDamping = { value: 0 };
    simulationStateVariable.material.uniforms.uMaxSpeed = { value: 0 };
    this.simulationStateVariable = simulationStateVariable;
    this.applyMovementUniforms();

    const capabilities = this.renderer.capabilities as THREE.WebGLRenderer["capabilities"] & {
      maxVertexTextures: number;
    };
    const originalMaxVertexTextures = capabilities.maxVertexTextures;
    if (originalMaxVertexTextures === 0) {
      // Compute + readback still work for the contract tests; only the visual point-render path needs vertex textures.
      capabilities.maxVertexTextures = 1;
    }

    const error = this.gpuComputationRenderer.init();
    capabilities.maxVertexTextures = originalMaxVertexTextures;
    if (error) {
      throw new Error(`Failed to initialize GPU simulation: ${error}`);
    }

    this.computeSimulationFrame(0);
    this.captureContractMilestoneIfConfigured(0);
    logger.info("Initialized GPU simulation and captured frame 0 contract.");
  }

  /** Release GPU computation resources. */
  public dispose() {
    this.gpuComputationRenderer.dispose();
  }

  /** Return current GPU texture used by particle render shaders. */
  public getStateTexture() {
    return this.gpuComputationRenderer.getCurrentRenderTarget(this.simulationStateVariable).texture;
  }

  /** Return current simulation frame number. */
  public getCurrentFrame() {
    return this.currentSimulationFrame;
  }

  public setMovementParams(nextParams: HelloShaderWorldMovementParams) {
    this.movementParams = clampHelloShaderWorldMovementParams(nextParams);
  }

  /** Reset simulation progression and clear all previously captured milestones. */
  public reset() {
    this.currentSimulationFrame = 0;
    this.elapsedSimulationSeconds = 0;
    this.deterministicRngState = this.deriveSeedUint32(this.deterministicSeedText);
    this.milestoneContractByFrame.clear();
    this.resetGpuStateTexture();
    this.computeSimulationFrame(0);
    this.captureContractMilestoneIfConfigured(0);
    logger.info("Reset GPU simulation to frame 0.");
  }

  /** Return currently active ball count. */
  public getActiveParticleCount() {
    return this.activeParticleIds.length;
  }

  /** Activate up to `amount` inactive particles at world center. */
  public addParticles(amount: number) {
    const normalizedParticleDelta = this.normalizeParticleDeltaRequest(amount);
    if (normalizedParticleDelta === 0) {
      return [] as number[];
    }

    this.readCurrentGpuStateIntoBuffer();
    const readbackData = this.gpuStateReadbackBuffer;
    const addedParticleIds: number[] = [];

    let added = 0;
    for (let particleId = 0; particleId < SHADER_PARTICLE_CAPACITY && added < normalizedParticleDelta; particleId += 1) {
      if (this.activeParticleLookupById[particleId] !== -1) {
        continue;
      }

      const particleOffset = particleId * 4;
      const spawnAngle = this.nextDeterministicRandom() * TAU;
      const spawnRadius = this.nextDeterministicRandom() * 0.04;
      const spawnSpeed = this.movementParams.maxSpeed * (0.35 + (this.nextDeterministicRandom() * 0.35));
      readbackData[particleOffset] = Math.cos(spawnAngle) * spawnRadius;
      readbackData[particleOffset + 1] = Math.sin(spawnAngle) * spawnRadius;
      readbackData[particleOffset + 2] = Math.cos(spawnAngle) * spawnSpeed;
      readbackData[particleOffset + 3] = Math.sin(spawnAngle) * spawnSpeed;
      this.markParticleAsActive(particleId);
      addedParticleIds.push(particleId);
      added += 1;
    }

    if (added > 0) {
      this.writeStateBufferToBothRenderTargets(readbackData);
    }

    return addedParticleIds;
  }

  /** Remove up to `amount` currently active particles using deterministic random selection. */
  public removeParticles(amount: number) {
    const normalizedParticleDelta = this.normalizeParticleDeltaRequest(amount);
    if (normalizedParticleDelta === 0 || this.activeParticleIds.length === 0) {
      return [] as number[];
    }

    const removedParticleIds: number[] = [];

    let removed = 0;
    for (; removed < normalizedParticleDelta && this.activeParticleIds.length > 0; removed += 1) {
      const randomActiveIndex = Math.floor(this.nextDeterministicRandom() * this.activeParticleIds.length);
      const particleId = this.activeParticleIds[randomActiveIndex];
      this.markParticleAsInactive(particleId);
      removedParticleIds.push(particleId);
    }

    return removedParticleIds;
  }

  /** Advance simulation by one frame and capture milestone report when configured. */
  public step() {
    const nextFrame = this.currentSimulationFrame + 1;
    this.currentSimulationFrame = nextFrame;
    this.elapsedSimulationSeconds += FIXED_TIME_STEP_SECONDS;

    this.computeSimulationFrame(nextFrame);
    return this.captureContractMilestoneIfConfigured(nextFrame);
  }

  /** Return contract text for one milestone frame or latest published milestone. */
  public getShaderContractText(frame?: number) {
    if (typeof frame === "number") {
      const exact = this.milestoneContractByFrame.get(frame);
      if (exact) {
        return exact;
      }

      throw new Error(`Shader contract for frame ${frame} is not available yet.`);
    }

    const latestFrame = Array.from(this.milestoneContractByFrame.keys())
      .sort((left, right) => left - right)
      .at(-1);

    if (latestFrame === undefined) {
      throw new Error("No shader contract is available yet.");
    }

    return this.milestoneContractByFrame.get(latestFrame) as string;
  }

  /** Execute one GPU computation pass configured for the provided frame number. */
  private computeSimulationFrame(frame: number) {
    this.simulationStateVariable.material.uniforms.uFrame.value = frame;
    this.simulationStateVariable.material.uniforms.uSeed.value = this.shaderSeedUniformValue;
    this.applyMovementUniforms();
    this.gpuComputationRenderer.compute();
  }

  private deriveNormalizedSeedUniform(seed: string) {
    return ((this.hashSeedToUint32(seed) >>> 0) % 1000000) / 1000000;
  }

  private deriveSeedUint32(seed: string) {
    return this.hashSeedToUint32(seed);
  }

  private hashSeedToUint32(seed: string) {
    let hash = FNV1A_32_OFFSET_BASIS;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, FNV1A_32_PRIME);
    }

    return hash >>> 0;
  }

  private applyMovementUniforms() {
    this.simulationStateVariable.material.uniforms.uAcceleration.value = this.movementParams.acceleration;
    this.simulationStateVariable.material.uniforms.uDirectionJitter.value = this.movementParams.directionJitter;
    this.simulationStateVariable.material.uniforms.uMagnitudeJitter.value = this.movementParams.magnitudeJitter;
    this.simulationStateVariable.material.uniforms.uDamping.value = this.movementParams.damping;
    this.simulationStateVariable.material.uniforms.uMaxSpeed.value = this.movementParams.maxSpeed;
  }

  private nextDeterministicRandom() {
    this.deterministicRngState ^= this.deterministicRngState << 13;
    this.deterministicRngState ^= this.deterministicRngState >>> 17;
    this.deterministicRngState ^= this.deterministicRngState << 5;
    return (this.deterministicRngState >>> 0) / 4294967296;
  }

  private normalizeParticleDeltaRequest(amount: number) {
    if (!Number.isFinite(amount)) {
      return 0;
    }

    return Math.max(0, Math.min(Math.floor(amount), SHADER_PARTICLE_CAPACITY));
  }

  private writeInitialSimulationState(data: Float32Array) {
    data.fill(0);
    this.activeParticleIds.length = 0;
    this.activeParticleLookupById.fill(-1);
    this.markParticleAsActive(0);
  }

  private resetGpuStateTexture() {
    const stagingTextureData = this.gpuStateStagingTexture.image.data;
    if (!(stagingTextureData instanceof Float32Array)) {
      throw new Error("Expected staging texture data to be a Float32Array.");
    }

    this.writeInitialSimulationState(stagingTextureData);
    this.writeStateBufferToBothRenderTargets(stagingTextureData);
  }

  private readCurrentGpuStateIntoBuffer() {
    const currentRenderTarget = this.gpuComputationRenderer.getCurrentRenderTarget(this.simulationStateVariable);
    this.renderer.readRenderTargetPixels(
      currentRenderTarget,
      0,
      0,
      SHADER_TEXTURE_SIZE,
      SHADER_TEXTURE_SIZE,
      this.gpuStateReadbackBuffer,
    );
  }

  private writeStateBufferToBothRenderTargets(data: Float32Array) {
    const stagingTextureData = this.gpuStateStagingTexture.image.data;
    if (!(stagingTextureData instanceof Float32Array)) {
      throw new Error("Expected staging texture data to be a Float32Array.");
    }

    stagingTextureData.set(data);
    const pingPongRenderTargets = this.getPingPongRenderTargets();
    this.gpuComputationRenderer.renderTexture(this.gpuStateStagingTexture, pingPongRenderTargets[0]);
    this.gpuComputationRenderer.renderTexture(this.gpuStateStagingTexture, pingPongRenderTargets[1]);
  }

  private getPingPongRenderTargets() {
    const stateVariableWithTargets = this.simulationStateVariable as Variable & {
      renderTargets?: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
    };
    if (!stateVariableWithTargets.renderTargets) {
      throw new Error("Expected simulation state variable render targets to be available.");
    }

    return stateVariableWithTargets.renderTargets;
  }

  private markParticleAsActive(particleId: number) {
    if (this.activeParticleLookupById[particleId] !== -1) {
      return;
    }

    this.activeParticleLookupById[particleId] = this.activeParticleIds.length;
    this.activeParticleIds.push(particleId);
  }

  private markParticleAsInactive(particleId: number) {
    const activeIndex = this.activeParticleLookupById[particleId];
    if (activeIndex === -1) {
      return;
    }

    const lastActiveParticleId = this.activeParticleIds[this.activeParticleIds.length - 1];
    this.activeParticleIds[activeIndex] = lastActiveParticleId;
    this.activeParticleLookupById[lastActiveParticleId] = activeIndex;
    this.activeParticleIds.pop();
    this.activeParticleLookupById[particleId] = -1;
  }

  /** Capture and store milestone text when this frame is configured as a report point. */
  private captureContractMilestoneIfConfigured(frame: number): ShaderMilestone | null {
    if (!SHADER_MILESTONE_FRAMES.includes(frame as (typeof SHADER_MILESTONE_FRAMES)[number])) {
      return null;
    }

    const currentRenderTarget = this.gpuComputationRenderer.getCurrentRenderTarget(this.simulationStateVariable);

    this.renderer.readRenderTargetPixels(
      currentRenderTarget,
      0,
      0,
      SHADER_TEXTURE_SIZE,
      SHADER_TEXTURE_SIZE,
      this.gpuStateReadbackBuffer,
    );

    const contractText = getShaderContractText({
      frame,
      textureSize: SHADER_TEXTURE_SIZE,
      values: new Float32Array(this.gpuStateReadbackBuffer),
    });

    this.milestoneContractByFrame.set(frame, contractText);
    logger.info("Captured shader milestone contract.", { frame });

    return {
      frame,
      contractText,
    };
  }
}
