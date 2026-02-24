import { Canvas } from "@react-three/fiber";

import { HelloShaderWorldScene } from "~/features/3d/hello-shader-world-scene";

export function HelloShaderWorldPage() {
  return (
    <section className="h-full w-full">
      <Canvas camera={{ position: [0, 0, 5], fov: 55 }}>
        <HelloShaderWorldScene />
      </Canvas>
    </section>
  );
}
