import { type Variable } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import * as THREE from "three";

import swarmWalkComputeShader from "~/features/3d/shaders/swarm-walk.compute.frag";
import { getSwarmWalkContractText } from "~/features/3d/swarm-walk-contract";
import { BaseDeterministicGpuSimulation } from "~/features/3d/base-gpu-simulation";
import { createLogger } from "~/lib/logger";

export const SWARM_TEXTURE_SIZE = 32;
export const SWARM_PEER_CAPACITY = SWARM_TEXTURE_SIZE * SWARM_TEXTURE_SIZE;
export const SWARM_MILESTONE_FRAMES = [0, 30, 60, 90] as const;
const FIXED_TIME_STEP_SECONDS = 1 / 60;

const logger = createLogger("swarm-walk-simulation");

export type SwarmMilestone = {
  frame: number;
  contractText: string;
};

/**
 * A hardware-accelerated, deterministic simulation of autonomous peers (swarm).
 */
export class DeterministicSwarmSimulation extends BaseDeterministicGpuSimulation {
  private readonly positionVariable: Variable;
  private readonly velocityVariable: Variable;

  private readonly seedText: string;
  private readonly seedValue: number;
  
  private readonly gpuReadbackBuffer = new Float32Array(SWARM_PEER_CAPACITY * 4);

  constructor(renderer: THREE.WebGLRenderer, seed: string) {
    super(renderer, SWARM_TEXTURE_SIZE);
    this.seedText = seed;
    this.seedValue = this.hashSeed(seed);
    
    const initialPosition = this.gpuCompute.createTexture();
    const initialVelocity = this.gpuCompute.createTexture();
    
    this.writeInitialState(
        initialPosition.image.data as Float32Array, 
        initialVelocity.image.data as Float32Array
    );

    this.positionVariable = this.gpuCompute.addVariable(
        "texturePosition", 
        `#define PASS_POSITION\n${swarmWalkComputeShader}`, 
        initialPosition
    );
    this.velocityVariable = this.gpuCompute.addVariable(
        "textureVelocity", 
        `#define PASS_VELOCITY\n${swarmWalkComputeShader}`, 
        initialVelocity
    );

    this.gpuCompute.setVariableDependencies(this.positionVariable, [this.positionVariable, this.velocityVariable]);
    this.gpuCompute.setVariableDependencies(this.velocityVariable, [this.positionVariable, this.velocityVariable]);

    this.setupUniforms(this.positionVariable);
    this.setupUniforms(this.velocityVariable);

    const error = this.gpuCompute.init();
    if (error) {
      throw new Error(`Failed to initialize Deterministic Swarm GPU simulation: ${error}`);
    }

    this.captureMilestoneIfNeeded(0);
    logger.info("Initialized Deterministic Swarm GPU simulation.");
  }

  private setupUniforms(variable: Variable) {
    variable.material.uniforms.uFrame = { value: 0 };
    variable.material.uniforms.uSeed = { value: this.seedValue };
    variable.material.uniforms.uDeltaTime = { value: FIXED_TIME_STEP_SECONDS };
    variable.material.uniforms.uAttraction = { value: 0.01 };
    variable.material.uniforms.uJitter = { value: 0.1 };
    variable.material.uniforms.uDamping = { value: 0.95 };
    variable.material.uniforms.uMaxSpeed = { value: 0.5 };
    variable.material.uniforms.uBounds = { value: 25.0 };
  }

  public dispose() {
    this.gpuCompute.dispose();
  }

  protected hashSeed(seed: string) {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000000) / 1000000;
  }

  public getStateTextures() {
    return {
      position: this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture,
      velocity: this.gpuCompute.getCurrentRenderTarget(this.velocityVariable).texture,
    };
  }

  public reset() {
    this.currentFrame = 0;
    this.milestoneContracts.clear();
    
    const initialPosition = this.gpuCompute.createTexture();
    const initialVelocity = this.gpuCompute.createTexture();
    this.writeInitialState(
        initialPosition.image.data as Float32Array, 
        initialVelocity.image.data as Float32Array
    );
    
    // We need to re-render the textures into the variables
    this.gpuCompute.renderTexture(initialPosition, (this.positionVariable as any).renderTargets[0]);
    this.gpuCompute.renderTexture(initialPosition, (this.positionVariable as any).renderTargets[1]);
    this.gpuCompute.renderTexture(initialVelocity, (this.velocityVariable as any).renderTargets[0]);
    this.gpuCompute.renderTexture(initialVelocity, (this.velocityVariable as any).renderTargets[1]);

    this.captureMilestoneIfNeeded(0);
    logger.info("Reset Deterministic Swarm GPU simulation.");
  }

  public step() {
    this.currentFrame++;
    this.positionVariable.material.uniforms.uFrame.value = this.currentFrame;
    this.velocityVariable.material.uniforms.uFrame.value = this.currentFrame;
    
    this.gpuCompute.compute();
    return this.captureMilestoneIfNeeded(this.currentFrame);
  }

  public getSwarmWalkContractText(frame?: number) {
    const targetFrame = frame ?? this.currentFrame;
    const exact = this.milestoneContracts.get(targetFrame);
    if (exact) {
      return exact;
    }
    throw new Error(`Deterministic swarm contract for frame ${targetFrame} is not available yet.`);
  }

  private writeInitialState(posData: Float32Array, velData: Float32Array) {
    // Simple seeded RNG for initial positions
    let rngState = this.hashSeedUint(this.seedText);
    const nextRandom = () => {
        rngState ^= rngState << 13;
        rngState ^= rngState >>> 17;
        rngState ^= rngState << 5;
        return (rngState >>> 0) / 4294967296;
    };

    for (let i = 0; i < SWARM_PEER_CAPACITY; i++) {
      const offset = i * 4;
      posData[offset] = (nextRandom() - 0.5) * 10;
      posData[offset + 1] = (nextRandom() - 0.5) * 10;
      posData[offset + 2] = (nextRandom() - 0.5) * 10;
      posData[offset + 3] = 0; // frame at frame 0

      velData[offset] = (nextRandom() - 0.5) * 0.1;
      velData[offset + 1] = (nextRandom() - 0.5) * 0.1;
      velData[offset + 2] = (nextRandom() - 0.5) * 0.1;
      velData[offset + 3] = 0;
    }
  }

  private hashSeedUint(seed: string) {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  private captureMilestoneIfNeeded(frame: number): SwarmMilestone | null {
    if (!SWARM_MILESTONE_FRAMES.includes(frame as any)) {
      return null;
    }

    this.readBuffer(this.positionVariable, this.gpuReadbackBuffer);

    const contractText = getSwarmWalkContractText({
      frame,
      peers: this.bufferToPeers(this.gpuReadbackBuffer),
    });

    this.milestoneContracts.set(frame, contractText);
    return { frame, contractText };
  }

  private bufferToPeers(buffer: Float32Array) {
    const peers = [];
    for (let i = 0; i < SWARM_PEER_CAPACITY; i++) {
        const offset = i * 4;
        peers.push({
            id: i,
            x: buffer[offset],
            y: buffer[offset + 1],
            z: buffer[offset + 2],
        });
    }
    return peers;
  }
}
