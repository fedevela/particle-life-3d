import * as THREE from "three";
import { GPUComputationRenderer, type Variable } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { createLogger } from "~/lib/logger";

const logger = createLogger("base-gpu-simulation");

/**
 * ARCHITECTURE: Base GPU Simulation
 * 
 * Boundary: Abstract base class for deterministic GPU-accelerated simulations.
 * Responsibility: Manages GPUComputationRenderer lifecycle and common utilities.
 * Seam: Subclasses implement initial state and variable setup.
 */
export abstract class BaseDeterministicGpuSimulation {
  protected readonly renderer: THREE.WebGLRenderer;
  protected readonly gpuCompute: GPUComputationRenderer;
  protected readonly textureSize: number;
  protected currentFrame = 0;
  protected readonly milestoneContracts = new Map<number, string>();

  constructor(renderer: THREE.WebGLRenderer, textureSize: number) {
    this.renderer = renderer;
    this.textureSize = textureSize;
    this.gpuCompute = new GPUComputationRenderer(textureSize, textureSize, this.renderer);
  }

  public abstract step(): void;

  public abstract reset(): void;

  public abstract dispose(): void;

  protected readBuffer(variable: Variable, buffer: Float32Array): void {
    const target = this.gpuCompute.getCurrentRenderTarget(variable);
    this.renderer.readRenderTargetPixels(
      target,
      0,
      0,
      this.textureSize,
      this.textureSize,
      buffer
    );
  }

  public getCurrentFrame(): number {
    return this.currentFrame;
  }
}
