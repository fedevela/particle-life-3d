import { GPUComputationRenderer, type Variable } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import * as THREE from "three";

import computeShader from "~/features/3d/shaders/hello-shader-world.compute.frag";
import { getShaderContractText } from "~/features/3d/hello-shader-world-contract";
import { createLogger } from "~/lib/logger";

/** Define the square texture size used by GPU simulation state. */
export const SHADER_TEXTURE_SIZE = 32;
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
  private readonly seedValue: number;

  /** Store published contracts by exact milestone frame number. */
  private readonly milestoneContracts = new Map<number, string>();

  /** Reuse one readback buffer to avoid allocations during milestone snapshots. */
  private readonly readbackBuffer = new Float32Array(SHADER_TEXTURE_SIZE * SHADER_TEXTURE_SIZE * 4);

  /** Initialize GPU simulation resources and seed frame 0 state. */
  constructor(renderer: THREE.WebGLRenderer, seed: string) {
    this.renderer = renderer;
    this.seedValue = this.hashSeed(seed);
    this.gpuCompute = new GPUComputationRenderer(SHADER_TEXTURE_SIZE, SHADER_TEXTURE_SIZE, this.renderer);

    const initialTexture = this.gpuCompute.createTexture();
    const data = initialTexture.image.data;
    if (!data) {
      throw new Error("Expected GPU initial texture data to be available.");
    }

    data.fill(0);

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
    this.milestoneContracts.clear();
    this.computeFrame(0);
    this.captureMilestoneIfNeeded(0);
    logger.info("Reset GPU simulation to frame 0.");
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
