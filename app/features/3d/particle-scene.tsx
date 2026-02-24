import { useMemo } from "react";
import * as THREE from "three";

import { CameraPersistenceControls } from "~/features/3d/camera-persistence-controls";
import type { SpriteEntity } from "~/db/types";
import { useSprites } from "~/hooks/use-sprites";

function createSphereTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create 2D canvas context for sphere texture.");
  }

  const gradient = context.createLinearGradient(0, 0, 128, 128);
  gradient.addColorStop(0, "#22d3ee");
  gradient.addColorStop(1, "#0284c7");

  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "rgba(255,255,255,0.25)";
  context.beginPath();
  context.arc(40, 40, 24, 0, Math.PI * 2);
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function SphereMesh({ sprite, texture }: { sprite: SpriteEntity; texture: THREE.Texture }) {
  const color = typeof sprite.metadata.color === "string" ? sprite.metadata.color : "#93c5fd";

  return (
    <mesh position={sprite.position}>
      <sphereGeometry args={[1, 40, 40]} />
      <meshStandardMaterial color={color} map={texture} metalness={0.15} roughness={0.45} />
    </mesh>
  );
}

export function ParticleScene() {
  const sprites = useSprites();
  const sphereTexture = useMemo(() => createSphereTexture(), []);

  for (const sprite of sprites) {
    if (sprite.type !== "sphere") {
      throw new Error(`Unsupported sprite type '${sprite.type}' for sprite '${sprite.id}'.`);
    }
  }

  return (
    <>
      <color attach="background" args={["#020617"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 6, 3]} intensity={1.2} />
      <gridHelper args={[30, 30, "#1d4ed8", "#1e293b"]} />
      {sprites.map((sprite, index) => (
        <SphereMesh key={`${sprite.id}-${index}`} sprite={sprite} texture={sphereTexture} />
      ))}
      <CameraPersistenceControls />
    </>
  );
}
