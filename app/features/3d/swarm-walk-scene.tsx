import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";

import { DeterministicSwarmSimulation, SWARM_PEER_CAPACITY } from "./swarm-walk-simulation";

/**
 * @requirement SWARM-001
 * @description Define the interface for testing the Swarm-Walk simulation.
 */
export type SwarmWalkTestApi = {
  getSwarmWalkContractText: (frame?: number) => Promise<string>;
  getCurrentFrame: () => number;
  resetSimulation: () => Promise<void>;
};

type SwarmWalkSceneProps = {
  seed: string;
  onTestApiReady?: (api: SwarmWalkTestApi) => void;
};

/**
 * Render scene lighting, helpers, and Swarm-Walk simulation elements.
 *
 * @returns Returns scene nodes mounted inside the Three.js canvas.
 */
export function SwarmWalkScene({ seed, onTestApiReady }: SwarmWalkSceneProps) {
  const { gl } = useThree();
  const simulationRef = useRef<DeterministicSwarmSimulation | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const simulation = new DeterministicSwarmSimulation(gl, seed);
    simulationRef.current = simulation;
    setIsInitialized(true);

    if (onTestApiReady) {
      onTestApiReady({
        getSwarmWalkContractText: async (frame) => {
          return simulation.getSwarmWalkContractText(frame);
        },
        getCurrentFrame: () => simulation.getCurrentFrame(),
        resetSimulation: async () => {
          simulation.reset();
        },
      });
    }

    return () => {
      simulation.dispose();
    };
  }, [gl, seed, onTestApiReady]);

  useFrame(() => {
    if (simulationRef.current) {
      simulationRef.current.step();
    }
  });

  return (
    <>
      <color attach="background" args={["#05111c"]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      <gridHelper args={[50, 50, "#1d4ed8", "#1e293b"]} />
      <OrbitControls makeDefault />
      
      {isInitialized && simulationRef.current && (
        <GPUInstancedPeers simulation={simulationRef.current} />
      )}
    </>
  );
}

function GPUInstancedPeers({ simulation }: { simulation: DeterministicSwarmSimulation }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Custom shader material to use simulation textures for positions
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
        color: "#60a5fa",
        emissive: "#2563eb",
        emissiveIntensity: 0.5,
    });
  }, []);

  // We use a custom shader to position peers using the texture
  const onBeforeCompile = (shader: any) => {
    shader.uniforms.texturePosition = { value: null };
    shader.vertexShader = `
      uniform sampler2D texturePosition;
      ${shader.vertexShader}
    `.replace(
      "#include <begin_vertex>",
      `
      #include <begin_vertex>
      vec2 uvPos = vec2(mod(float(gl_InstanceID), 32.0) / 32.0, floor(float(gl_InstanceID) / 32.0) / 32.0);
      vec4 posData = texture2D(texturePosition, uvPos);
      transformed += posData.xyz;
      `
    );
    
    // Store reference to update uniforms
    (material as any).shader = shader;
  };

  material.onBeforeCompile = onBeforeCompile;

  useFrame(() => {
    if (simulation && (material as any).shader) {
      (material as any).shader.uniforms.texturePosition.value = simulation.getStateTextures().position;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, SWARM_PEER_CAPACITY]}>
      <sphereGeometry args={[0.3, 12, 12]} />
      <primitive object={material} attach="material" />
    </instancedMesh>
  );
}
