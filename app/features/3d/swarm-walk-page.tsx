import { Canvas } from "@react-three/fiber";

import { SwarmWalkScene } from "~/features/3d/swarm-walk-scene";

/**
 * Render the top-level page container for the Swarm-Walk simulation.
 *
 * @returns Returns the full-size canvas page section.
 */
export function SwarmWalkPage() {
  return (
    <section className="h-full w-full">
      <Canvas camera={{ position: [0, 10, 20], fov: 60 }}>
        <SwarmWalkScene />
      </Canvas>
    </section>
  );
}
