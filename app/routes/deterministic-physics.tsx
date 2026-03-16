import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import * as THREE from "three";
import { DeterministicPhysicsSimulation, createDeterministicPhysicsTestApi } from "~/features/3d/deterministic-physics-simulation";
import { createLogger } from "~/lib/logger";

const logger = createLogger("deterministic-physics-page");

/**
 * INTEGRATION SEAM: Deterministic Physics Baseline Page
 * 
 * Boundary: Orchestrates THREE.js lifecycle and the DeterministicPhysicsSimulation.
 * Seam: Exposes (window as any).__DETERMINISTIC_PHYSICS_TEST_API__ for contract verification.
 * Traceability: SWARM-002, SWARM-003, SWARM-006, SWARM-007
 */
export default function DeterministicPhysicsPage() {
  const [searchParams] = useSearchParams();
  const seed = searchParams.get("seed") || "default-seed";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<DeterministicPhysicsSimulation | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // 1. [SWARM-007] Initialize THREE.js with deterministic simulation
    const renderer = new THREE.WebGLRenderer({ 
        canvas: canvasRef.current,
        antialias: true,
        alpha: true 
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    rendererRef.current = renderer;

    const params = {
        friction: parseFloat(searchParams.get("friction") || "0.1"),
        boundsMin: (searchParams.get("boundsMin") || "-10,-10,-10").split(",").map(Number) as [number, number, number],
        boundsMax: (searchParams.get("boundsMax") || "10,10,10").split(",").map(Number) as [number, number, number],
        deltaTime: parseFloat(searchParams.get("deltaTime") || (1 / 60).toString()),
        initialVelocityJitter: parseFloat(searchParams.get("vJitter") || "0"),
    };

    const simulation = new DeterministicPhysicsSimulation(renderer, seed, params);
    simulationRef.current = simulation;
    
    // 2. [SWARM-002, SWARM-003, SWARM-006] Expose contract verification API to window
    (window as any).__DETERMINISTIC_PHYSICS_TEST_API__ = createDeterministicPhysicsTestApi(simulation);
    logger.info("Deterministic physics test API exposed to window.", { seed });

    // 3. Render Loop (Skeleton)
    let animationFrameId: number;
    const animate = () => {
      if (searchParams.get("paused") !== "true") {
        simulation.step();
      }
      // Rendering logic (Scene/Camera) deferred to Malkhut.
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      cancelAnimationFrame(animationFrameId);
      simulation.dispose();
      renderer.dispose();
      delete (window as any).__DETERMINISTIC_PHYSICS_TEST_API__;
      logger.info("Deterministic physics simulation cleaned up.");
    };
  }, [seed]);

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      <div className="p-4 bg-slate-800 border-b border-slate-700 text-slate-100 flex justify-between items-center">
        <div className="flex items-center gap-4">
            <h1 className="font-mono font-bold">Deterministic Physics Baseline</h1>
            <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-400">#53</span>
        </div>
        <div className="flex gap-4 text-xs font-mono">
            <div className="bg-slate-900 px-3 py-1 rounded border border-slate-700">
                <span className="text-slate-500">SEED:</span> {seed}
            </div>
            <div className="bg-slate-900 px-3 py-1 rounded border border-slate-700">
                <span className="text-slate-500">TRACER:</span> SWARM-002,003,006,007
            </div>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} className="w-full h-full" />
        <div className="absolute top-8 left-8 text-slate-500 font-mono text-xs pointer-events-none">
            [ARCHITECTURE_READY_FOR_MALKHUT]
        </div>
      </div>
    </div>
  );
}
