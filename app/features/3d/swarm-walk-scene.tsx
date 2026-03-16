import { OrbitControls } from "@react-three/drei";

/**
 * Render scene lighting, helpers, and Swarm-Walk simulation elements.
 *
 * @returns Returns scene nodes mounted inside the Three.js canvas.
 */
export function SwarmWalkScene() {
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
