import { useEffect, useRef, useState } from "react";
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

  // UI State
  const [boundaryType, setBoundaryType] = useState<'bounce' | 'wrap'>(
    (searchParams.get("boundaryType") as 'bounce' | 'wrap') || 'bounce'
  );

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
        boundaryType: boundaryType, // Use state for initial value
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
  }, [seed]); // Re-run if seed changes (full reset)

  // Effect to handle runtime updates to boundary type
  useEffect(() => {
    if (simulationRef.current) {
        simulationRef.current.setBoundaryType(boundaryType);
    }
  }, [boundaryType]);

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
        
        {/* Controls Overlay */}
        <div className="absolute top-8 left-8 bg-slate-800/90 border border-slate-700 p-4 rounded shadow-xl backdrop-blur text-slate-200 w-64">
            <h2 className="font-mono text-xs uppercase text-slate-500 mb-4 border-b border-slate-700 pb-2">Environment Controls</h2>
            
            <div className="flex items-center justify-between mb-2">
                <label htmlFor="boundary-toggle" className="text-sm font-medium">Infinity Mode</label>
                <button
                    id="boundary-toggle"
                    onClick={() => setBoundaryType(boundaryType === 'bounce' ? 'wrap' : 'bounce')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                        boundaryType === 'wrap' ? 'bg-indigo-600' : 'bg-slate-600'
                    }`}
                >
                    <span className="sr-only">Toggle Infinity Mode</span>
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            boundaryType === 'wrap' ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
                {boundaryType === 'bounce' 
                    ? "Particles reflect off the volume boundaries (Box)." 
                    : "Particles wrap around edges (Toroidal)."}
            </p>
        </div>

        <div className="absolute bottom-8 left-8 text-slate-500 font-mono text-xs pointer-events-none">
            [ARCHITECTURE_READY_FOR_MALKHUT]
        </div>
      </div>
    </div>
  );
}
