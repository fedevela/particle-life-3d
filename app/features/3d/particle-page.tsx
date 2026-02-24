import { Canvas } from "@react-three/fiber";

import { ParticleScene } from "~/features/3d/particle-scene";

export function ParticlePage() {
  return (
    <section className="h-full w-full">
      <Canvas camera={{ position: [4, 4, 6], fov: 55 }}>
        <ParticleScene />
      </Canvas>
    </section>
  );
}
