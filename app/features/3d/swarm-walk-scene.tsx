import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";

import { getSwarmWalkContractText, type SwarmWalkSnapshot } from "./swarm-walk-contract";

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

type EntityState = {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
};

const ENTITY_COUNT = 50;
const BOUNDS = 25;

/**
 * Render scene lighting, helpers, and Swarm-Walk simulation elements.
 *
 * @returns Returns scene nodes mounted inside the Three.js canvas.
 */
export function SwarmWalkScene({ seed, onTestApiReady }: SwarmWalkSceneProps) {
  const frameRef = useRef(0);
  const entitiesRef = useRef<EntityState[]>([]);
  const initialEntitiesRef = useRef<EntityState[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize simulation
  const initializeSimulation = (seedValue: string) => {
    frameRef.current = 0;

    // Simple hash for seed string
    let seedNum = 0;
    for (let i = 0; i < seedValue.length; i++) {
      seedNum = (seedNum << 5) - seedNum + seedValue.charCodeAt(i);
      seedNum |= 0;
    }

    const rng = () => {
      seedNum = (seedNum * 1664525 + 1013904223) | 0;
      return (seedNum >>> 0) / 0xffffffff;
    };

    const newEntities: EntityState[] = [];
    for (let i = 0; i < ENTITY_COUNT; i++) {
      newEntities.push({
        id: i,
        position: new THREE.Vector3(
          (rng() - 0.5) * 10,
          (rng() - 0.5) * 10,
          (rng() - 0.5) * 10,
        ),
        velocity: new THREE.Vector3(
          (rng() - 0.5) * 0.1,
          (rng() - 0.5) * 0.1,
          (rng() - 0.5) * 0.1,
        ),
      });
    }
    
    // Store deep copies for initial state
    initialEntitiesRef.current = newEntities.map(e => ({
      ...e,
      position: e.position.clone(),
      velocity: e.velocity.clone()
    }));
    
    entitiesRef.current = newEntities;
    setIsInitialized(true);
  };

  useEffect(() => {
    initializeSimulation(seed);
  }, [seed]);

  // Expose Test API
  useEffect(() => {
    if (onTestApiReady) {
      onTestApiReady({
        getSwarmWalkContractText: async (frame) => {
          const targetFrame = frame ?? frameRef.current;
          const targetEntities = targetFrame === 0 ? initialEntitiesRef.current : entitiesRef.current;
          
          const snapshot: SwarmWalkSnapshot = {
            frame: targetFrame,
            entities: targetEntities.map((e) => ({
              id: e.id,
              x: e.position.x,
              y: e.position.y,
              z: e.position.z,
            })),
          };
          return getSwarmWalkContractText(snapshot);
        },
        getCurrentFrame: () => frameRef.current,
        resetSimulation: async () => {
          initializeSimulation(seed);
        },
      });
    }
  }, [onTestApiReady, seed]);

  useFrame((_state, delta) => {
    if (!isInitialized) return;

    frameRef.current++;
    const entities = entitiesRef.current;

    // Center point for swarm attraction
    const center = new THREE.Vector3(0, 0, 0);

    for (const entity of entities) {
      // 1. Random walk component
      const randomForce = new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2,
      );
      entity.velocity.add(randomForce);

      // 2. Attraction to center (the "swarm" part)
      const toCenter = center.clone().sub(entity.position).multiplyScalar(0.01);
      entity.velocity.add(toCenter);

      // 3. Speed limit
      entity.velocity.clampLength(0, 0.5);

      // 4. Update position
      entity.position.add(entity.velocity.clone().multiplyScalar(delta * 60));

      // 5. Hard bounds check
      if (entity.position.length() > BOUNDS) {
        entity.position.setLength(BOUNDS);
        entity.velocity.multiplyScalar(-0.5); // Bounce back softly
      }
    }
  });

  return (
    <>
      <color attach="background" args={["#05111c"]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      <gridHelper args={[50, 50, "#1d4ed8", "#1e293b"]} />
      <OrbitControls makeDefault />
      
      {isInitialized && <InstancedEntities entities={entitiesRef.current} />}
    </>
  );
}

function InstancedEntities({ entities }: { entities: EntityState[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    if (meshRef.current) {
      entities.forEach((entity, i) => {
        tempObject.position.copy(entity.position);
        tempObject.updateMatrix();
        meshRef.current!.setMatrixAt(i, tempObject.matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, ENTITY_COUNT]}>
      <sphereGeometry args={[0.3, 12, 12]} />
      <meshStandardMaterial color="#60a5fa" emissive="#2563eb" emissiveIntensity={0.5} />
    </instancedMesh>
  );
}
