import { OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

import fragmentShader from "~/features/3d/shaders/hello-shader-world.frag";
import vertexShader from "~/features/3d/shaders/hello-shader-world.vert";

function createRandomColor() {
  return new THREE.Color(Math.random(), Math.random(), Math.random());
}

function createPositionAttribute() {
  return new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3);
}

export function HelloShaderWorldScene() {
  const positionAttribute = useMemo(() => createPositionAttribute(), []);
  const randomColor = useMemo(() => createRandomColor(), []);

  return (
    <>
      <gridHelper args={[12, 12, "#1d4ed8", "#1e293b"]} />
      <points>
        <bufferGeometry>
          <primitive attach="attributes-position" object={positionAttribute} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{
            uColor: { value: randomColor },
          }}
        />
      </points>
      <OrbitControls />
    </>
  );
}
