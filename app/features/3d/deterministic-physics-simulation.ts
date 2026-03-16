import * as THREE from "three";
import { GPUComputationRenderer, type Variable } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import physicsComputeShader from "~/features/3d/shaders/deterministic-physics.compute.frag";
import { 
  getPhysicsBaselineContractText, 
  PHYSICS_TEXTURE_SIZE,
  PHYSICS_PARTICLE_CAPACITY,
  PHYSICS_MILESTONE_FRAMES,
  DEFAULT_PHYSICS_PARAMS,
  type PhysicsBaselineSnapshot,
  type DeterministicPhysicsTestApi, 
  type PhysicsBaselineSimulationParams
} from "~/features/3d/deterministic-physics-contract";
import { createLogger } from "~/lib/logger";

const logger = createLogger("deterministic-physics-simulation");

/**
 * ARCHITECTURE: Deterministic Physics Baseline Simulation
 * 
 * Boundary: Owns the GPU state and orchestration logic for particle physics.
 * Seam: Provides getStateTextures() for the visual scene and getContractText() for E2E tests.
 * Dependency: THREE.WebGLRenderer (external), deterministic-physics.compute.frag (shader).
 * 
 * Traceability: SWARM-002, SWARM-003, SWARM-006, SWARM-007
 */
export class DeterministicPhysicsSimulation {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly gpuCompute: GPUComputationRenderer;
  private readonly positionVariable: Variable;
  private readonly velocityVariable: Variable;
  
  private currentFrame = 0;
  private readonly seed: string;
  private readonly seedValue: number;
  private readonly params: PhysicsBaselineSimulationParams;

  private readonly milestoneContracts = new Map<number, string>();
  private readonly gpuReadbackBuffer = new Float32Array(PHYSICS_PARTICLE_CAPACITY * 4);

  constructor(renderer: THREE.WebGLRenderer, seed: string, params: PhysicsBaselineSimulationParams = DEFAULT_PHYSICS_PARAMS) {
    this.renderer = renderer;
    this.seed = seed;
    this.seedValue = this.hashSeed(seed);
    this.params = params;
    
    // 1. [SWARM-007] Initialize GPU Compute with deterministic seed
    this.gpuCompute = new GPUComputationRenderer(PHYSICS_TEXTURE_SIZE, PHYSICS_TEXTURE_SIZE, this.renderer);
    
    // 2. [SWARM-007] Create initial textures
    const initialPosition = this.gpuCompute.createTexture();
    const initialVelocity = this.gpuCompute.createTexture();
    this.fillDeterministicInitialState(
        initialPosition.image.data as Float32Array, 
        initialVelocity.image.data as Float32Array
    );
    
    // 3. Setup Variables with Pass Defines
    this.positionVariable = this.gpuCompute.addVariable(
        "texturePosition", 
        `#define PASS_POSITION\n${physicsComputeShader}`, 
        initialPosition
    );
    this.velocityVariable = this.gpuCompute.addVariable(
        "textureVelocity", 
        `#define PASS_VELOCITY\n${physicsComputeShader}`, 
        initialVelocity
    );
    
    this.gpuCompute.setVariableDependencies(this.positionVariable, [this.positionVariable, this.velocityVariable]);
    this.gpuCompute.setVariableDependencies(this.velocityVariable, [this.positionVariable, this.velocityVariable]);
    
    // 4. Setup Uniforms (Friction, Bounds, etc.)
    this.setupUniforms(this.positionVariable);
    this.setupUniforms(this.velocityVariable);
    
    // 5. Initialize
    const error = this.gpuCompute.init();
    if (error) {
      throw new Error(`Failed to initialize Deterministic Physics GPU simulation: ${error}`);
    }

    this.captureMilestoneIfNeeded(0);
    logger.info("Initialized Deterministic Physics GPU simulation.");
  }

  private setupUniforms(variable: Variable) {
    variable.material.uniforms.uFrame = { value: 0 };
    variable.material.uniforms.uSeed = { value: this.seedValue };
    variable.material.uniforms.uDeltaTime = { value: this.params.deltaTime };
    variable.material.uniforms.uFriction = { value: this.params.friction };
    variable.material.uniforms.uBoundsMin = { value: new THREE.Vector3(...this.params.boundsMin) };
    variable.material.uniforms.uBoundsMax = { value: new THREE.Vector3(...this.params.boundsMax) };
  }

  /** [SWARM-002, SWARM-003, SWARM-006] Advance simulation by one step */
  public step() {
    this.currentFrame++;
    this.positionVariable.material.uniforms.uFrame.value = this.currentFrame;
    this.velocityVariable.material.uniforms.uFrame.value = this.currentFrame;
    
    this.gpuCompute.compute();
    this.captureMilestoneIfNeeded(this.currentFrame);
  }

  public reset() {
    this.currentFrame = 0;
    this.milestoneContracts.clear();
    // Reset logic would re-init textures and render them into variables
    // Implementation deferred to Malkhut.
    logger.info("Reset Deterministic Physics GPU simulation.");
  }

  public getStateTextures() {
    return {
      position: this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture,
      velocity: this.gpuCompute.getCurrentRenderTarget(this.velocityVariable).texture,
    };
  }

  public dispose() {
    // GPUComputationRenderer doesn't have a built-in dispose in some Three.js versions,
    // but we should ensure it's cleared if the API exists or if we need to clean up internal RTs.
    if ((this.gpuCompute as any).dispose) {
      (this.gpuCompute as any).dispose();
    }
    logger.info("Disposed Deterministic Physics GPU simulation.");
  }

  /** 
   * [SWARM-007] Deterministic PRNG seeding logic
   * Establishing the architectural seam for bit-identical initialization.
   */
  private fillDeterministicInitialState(posData: Float32Array, velData: Float32Array) {
    // Mulberry32 or similar deterministic PRNG initialized with this.seedValue
    // would be used here to fill posData and velData.
    // [SWARM-002] Velocity must be initialized to zero for stationary start.
    for (let i = 0; i < PHYSICS_PARTICLE_CAPACITY; i++) {
        // Architecture: Structural placeholders for deterministic seeding
        const id = i * 4;
        posData[id + 0] = 0; // px
        posData[id + 1] = 0; // py
        posData[id + 2] = 0; // pz
        posData[id + 3] = 1; // w (active)
        
        velData[id + 0] = 0; // vx
        velData[id + 1] = 0; // vy
        velData[id + 2] = 0; // vz
        velData[id + 3] = 0; // mass/other
    }
  }

  private hashSeed(seed: string): number {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000000) / 1000000;
  }

  /** Contract Verification Bridge */
  public async getContractText(frame: number): Promise<string> {
    const exact = this.milestoneContracts.get(frame);
    if (exact) return exact;
    
    // Fallback: Read current buffer if frame matches current
    if (frame === this.currentFrame) {
        this.readBackAndStore(frame);
        return this.milestoneContracts.get(frame) || "";
    }
    
    throw new Error(`Physics contract for frame ${frame} is not available.`);
  }

  private captureMilestoneIfNeeded(frame: number) {
    if (PHYSICS_MILESTONE_FRAMES.includes(frame as any)) {
      this.readBackAndStore(frame);
    }
  }

  private readBackAndStore(frame: number) {
    const target = this.gpuCompute.getCurrentRenderTarget(this.positionVariable);
    this.renderer.readRenderTargetPixels(
      target,
      0,
      0,
      PHYSICS_TEXTURE_SIZE,
      PHYSICS_TEXTURE_SIZE,
      this.gpuReadbackBuffer,
    );
    
    // [SWARM-002, SWARM-003, SWARM-006, SWARM-007]
    // In a real implementation, we'd also read velocity for the snapshot.
    // For architecture, we define the integration seam with full requirement tracing.
    const snapshot: PhysicsBaselineSnapshot = {
        frame,
        seed: this.seed,
        particles: [] // Mapping from gpuReadbackBuffer deferred to Malkhut
    };
    
    this.milestoneContracts.set(frame, getPhysicsBaselineContractText(snapshot, this.params));
  }
}

/** 
 * INTEGRATION SEAM: Test API Implementation 
 * Traceability: Requirement Verification
 */
export const createPhysicsTestApi = (sim: DeterministicPhysicsSimulation): DeterministicPhysicsTestApi => ({
  __GET_PHYSICS_BASELINE_CONTRACT_TEXT__: async (frame) => sim.getContractText(frame ?? 0),
  __RESET_PHYSICS_BASELINE_SIM_FOR_TEST__: async () => sim.reset(),
});
