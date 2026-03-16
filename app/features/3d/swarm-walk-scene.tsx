import { OrbitControls } from "@react-three/drei";

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
  onTestApiReady?: (api: SwarmWalkTestApi) => void;
};

/**
 * Render scene lighting, helpers, and Swarm-Walk simulation elements.
 *
 * @returns Returns scene nodes mounted inside the Three.js canvas.
 */
export function SwarmWalkScene({ onTestApiReady }: SwarmWalkSceneProps) {
  return (
    <>
      <color attach="background" args={["#05111c"]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      <gridHelper args={[50, 50, "#1d4ed8", "#1e293b"]} />
      <OrbitControls makeDefault />
      {/* Simulation elements will go here. */}
    </>
  );
}
