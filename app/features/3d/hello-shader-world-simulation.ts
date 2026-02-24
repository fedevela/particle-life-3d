import { GPUComputationRenderer, type Variable } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import * as THREE from "three";

import computeShader from "~/features/3d/shaders/hello-shader-world.compute.frag";
import { getShaderContractText } from "~/features/3d/hello-shader-world-contract";
import { createLogger } from "~/lib/logger";

/** Define the square texture size used by GPU simulation state. */
export const SHADER_TEXTURE_SIZE = 32;
export const SHADER_PARTICLE_CAPACITY = SHADER_TEXTURE_SIZE * SHADER_TEXTURE_SIZE;
/** Define exact frame numbers where the shader publishes milestone contracts. */
export const SHADER_MILESTONE_FRAMES = [0, 30, 60, 90] as const;
/** Define a fixed simulation timestep used for deterministic frame progression. */
const FIXED_TIME_STEP_SECONDS = 1 / 60;
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
  private readonly gpuCompute: GPUComputationRenderer;
  private readonly stateVariable: Variable;

  /** Keep current simulation frame + elapsed time progression. */
  private frame = 0;
  private elapsedTimeSeconds = 0;
  private readonly seedText: string;
  private readonly seedValue: number;
  private rngState: number;

  /** Store published contracts by exact milestone frame number. */
  private readonly milestoneContracts = new Map<number, string>();

  /** Reuse one readback buffer to avoid allocations during milestone snapshots. */
  private readonly readbackBuffer = new Float32Array(SHADER_PARTICLE_CAPACITY * 4);
  private readonly stagingTexture: THREE.DataTexture;

  /** Keep active particle indexes to support deterministic add/remove operations. */
  private readonly activeParticleIndexes: number[] = [];
  private readonly activeIndexByParticle = new Int32Array(SHADER_PARTICLE_CAPACITY).fill(-1);

  /** Initialize GPU simulation resources and seed frame 0 state. */
  constructor(renderer: THREE.WebGLRenderer, seed: string) {
    this.renderer = renderer;
    this.seedText = seed;
    this.seedValue = this.hashSeed(seed);
    this.rngState = this.hashSeedUint(seed);
    this.gpuCompute = new GPUComputationRenderer(SHADER_TEXTURE_SIZE, SHADER_TEXTURE_SIZE, this.renderer);

    const initialTexture = this.gpuCompute.createTexture();
    this.stagingTexture = this.gpuCompute.createTexture();
    const data = initialTexture.image.data;
    if (!(data instanceof Float32Array)) {
      throw new Error("Expected GPU initial texture data to be a Float32Array.");
    }

    this.writeInitialState(data);

    const stateVariable = this.gpuCompute.addVariable("textureState", computeShader, initialTexture);
    this.gpuCompute.setVariableDependencies(stateVariable, [stateVariable]);
    stateVariable.material.uniforms.uFrame = { value: 0 };
    stateVariable.material.uniforms.uSeed = { value: this.seedValue };
    this.stateVariable = stateVariable;

    const error = this.gpuCompute.init();
    if (error) {
      throw new Error(`Failed to initialize GPU simulation: ${error}`);
    }

    this.computeFrame(0);
    this.captureMilestoneIfNeeded(0);
    logger.info("Initialized GPU simulation and captured frame 0 contract.");
  }

  /** Release GPU computation resources. */
  public dispose() {
    this.gpuCompute.dispose();
  }

  /** Return current GPU texture used by particle render shaders. */
  public getStateTexture() {
    return this.gpuCompute.getCurrentRenderTarget(this.stateVariable).texture;
  }

  /** Return current simulation frame number. */
  public getCurrentFrame() {
    return this.frame;
  }

  /** Reset simulation progression and clear all previously captured milestones. */
  public reset() {
    this.frame = 0;
    this.elapsedTimeSeconds = 0;
    this.rngState = this.hashSeedUint(this.seedText);
    this.milestoneContracts.clear();
    this.resetGpuState();
    this.computeFrame(0);
    this.captureMilestoneIfNeeded(0);
    logger.info("Reset GPU simulation to frame 0.");
  }

  /** Return currently active ball count. */
  public getActiveParticleCount() {
    return this.activeParticleIndexes.length;
  }

  /** Activate up to `amount` inactive particles at world center. */
  public addParticles(amount: number) {
    const requestedAmount = this.normalizeRequestedAmount(amount);
    if (requestedAmount === 0) {
      return [] as number[];
    }

    this.readCurrentStateBuffer();
    const data = this.readbackBuffer;
    const addedIndexes: number[] = [];

    let added = 0;
    for (let index = 0; index < SHADER_PARTICLE_CAPACITY && added < requestedAmount; index += 1) {
      if (this.activeIndexByParticle[index] !== -1) {
        continue;
      }

      const offset = index * 4;
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
      this.markParticleActive(index);
      addedIndexes.push(index);
      added += 1;
    }

    if (added > 0) {
      this.writeStateToGpu(data);
    }

    return addedIndexes;
  }

  /** Remove up to `amount` currently active particles using deterministic random selection. */
  public removeParticles(amount: number) {
    const requestedAmount = this.normalizeRequestedAmount(amount);
    if (requestedAmount === 0 || this.activeParticleIndexes.length === 0) {
      return [] as number[];
    }

    const removedIndexes: number[] = [];

    let removed = 0;
    for (; removed < requestedAmount && this.activeParticleIndexes.length > 0; removed += 1) {
      const randomIndex = Math.floor(this.nextRandom() * this.activeParticleIndexes.length);
      const particleIndex = this.activeParticleIndexes[randomIndex];
      this.markParticleInactive(particleIndex);
      removedIndexes.push(particleIndex);
    }

    return removedIndexes;
  }

  /** Advance simulation by one frame and capture milestone report when configured. */
  public step() {
    const nextFrame = this.frame + 1;
    this.frame = nextFrame;
    this.elapsedTimeSeconds += FIXED_TIME_STEP_SECONDS;

    this.computeFrame(nextFrame);
    return this.captureMilestoneIfNeeded(nextFrame);
  }

  /** Return contract text for one milestone frame or latest published milestone. */
  public getShaderContractText(frame?: number) {
    if (typeof frame === "number") {
      const exact = this.milestoneContracts.get(frame);
      if (exact) {
        return exact;
      }

      throw new Error(`Shader contract for frame ${frame} is not available yet.`);
    }

    const latestFrame = Array.from(this.milestoneContracts.keys())
      .sort((left, right) => left - right)
      .at(-1);

    if (latestFrame === undefined) {
      throw new Error("No shader contract is available yet.");
    }

    return this.milestoneContracts.get(latestFrame) as string;
  }

  /** Execute one GPU computation pass configured for the provided frame number. */
  private computeFrame(frame: number) {
    this.stateVariable.material.uniforms.uFrame.value = frame;
    this.stateVariable.material.uniforms.uSeed.value = this.seedValue;
    this.gpuCompute.compute();
  }

  private hashSeed(seed: string) {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return ((hash >>> 0) % 1000000) / 1000000;
  }

  private hashSeedUint(seed: string) {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }

  private nextRandom() {
    this.rngState ^= this.rngState << 13;
    this.rngState ^= this.rngState >>> 17;
    this.rngState ^= this.rngState << 5;
    return (this.rngState >>> 0) / 4294967296;
  }

  private normalizeRequestedAmount(amount: number) {
    if (!Number.isFinite(amount)) {
      return 0;
    }

    return Math.max(0, Math.min(Math.floor(amount), SHADER_PARTICLE_CAPACITY));
  }

  private writeInitialState(data: Float32Array) {
    data.fill(0);
    this.activeParticleIndexes.length = 0;
    this.activeIndexByParticle.fill(-1);
    this.markParticleActive(0);
  }

  private resetGpuState() {
    const data = this.stagingTexture.image.data;
    if (!(data instanceof Float32Array)) {
      throw new Error("Expected staging texture data to be a Float32Array.");
    }

    this.writeInitialState(data);
    this.writeStateToGpu(data);
  }

  private readCurrentStateBuffer() {
    const target = this.gpuCompute.getCurrentRenderTarget(this.stateVariable);
    this.renderer.readRenderTargetPixels(target, 0, 0, SHADER_TEXTURE_SIZE, SHADER_TEXTURE_SIZE, this.readbackBuffer);
  }

  private writeStateToGpu(data: Float32Array) {
    const stagingData = this.stagingTexture.image.data;
    if (!(stagingData instanceof Float32Array)) {
      throw new Error("Expected staging texture data to be a Float32Array.");
    }

    stagingData.set(data);
    const renderTargets = this.getStateRenderTargets();
    this.gpuCompute.renderTexture(this.stagingTexture, renderTargets[0]);
    this.gpuCompute.renderTexture(this.stagingTexture, renderTargets[1]);
  }

  private getStateRenderTargets() {
    const stateVariableWithTargets = this.stateVariable as Variable & {
      renderTargets?: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
    };
    if (!stateVariableWithTargets.renderTargets) {
      throw new Error("Expected simulation state variable render targets to be available.");
    }

    return stateVariableWithTargets.renderTargets;
  }

  private markParticleActive(index: number) {
    if (this.activeIndexByParticle[index] !== -1) {
      return;
    }

    this.activeIndexByParticle[index] = this.activeParticleIndexes.length;
    this.activeParticleIndexes.push(index);
  }

  private markParticleInactive(index: number) {
    const activeIndex = this.activeIndexByParticle[index];
    if (activeIndex === -1) {
      return;
    }

    const lastParticleIndex = this.activeParticleIndexes[this.activeParticleIndexes.length - 1];
    this.activeParticleIndexes[activeIndex] = lastParticleIndex;
    this.activeIndexByParticle[lastParticleIndex] = activeIndex;
    this.activeParticleIndexes.pop();
    this.activeIndexByParticle[index] = -1;
  }

  /** Capture and store milestone text when this frame is configured as a report point. */
  private captureMilestoneIfNeeded(frame: number): ShaderMilestone | null {
    if (!SHADER_MILESTONE_FRAMES.includes(frame as (typeof SHADER_MILESTONE_FRAMES)[number])) {
      return null;
    }

    const target = this.gpuCompute.getCurrentRenderTarget(this.stateVariable);

    this.renderer.readRenderTargetPixels(
      target,
      0,
      0,
      SHADER_TEXTURE_SIZE,
      SHADER_TEXTURE_SIZE,
      this.readbackBuffer,
    );

    const contractText = getShaderContractText({
      frame,
      textureSize: SHADER_TEXTURE_SIZE,
      values: new Float32Array(this.readbackBuffer),
    });

    this.milestoneContracts.set(frame, contractText);
    logger.info("Captured shader milestone contract.", { frame });

    return {
      frame,
      contractText,
    };
  }
}
