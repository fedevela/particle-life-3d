import { useMemo } from "react";
import * as THREE from "three";

import {
  CameraPersistenceControls,
  type CameraPersistenceTestApi,
} from "~/features/3d/camera-persistence-controls";
import type { SpriteEntity } from "~/db/types";
import { usePeers } from "~/hooks/use-peers";

/** Define scene props used by runtime and test wiring. */
type ParticleSceneProps = {
  projectId: string;
  onCameraTestApiReady?: (api: CameraPersistenceTestApi | null) => void;
};

/** Create a reusable procedural sphere texture used by peer materials. */
function createPeerTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create 2D canvas context for peer texture.");
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

/** Render one sphere mesh for a validated peer entity. */
function PeerSphere({ peer, texture }: { peer: SpriteEntity; texture: THREE.Texture }) {
  const color = typeof peer.metadata.color === "string" ? peer.metadata.color : "#93c5fd";

  return (
    <mesh position={peer.position}>
      <sphereGeometry args={[1, 40, 40]} />
      <meshStandardMaterial color={color} map={texture} metalness={0.15} roughness={0.45} />
    </mesh>
  );
}

/**
 * Render scene lighting, helpers, peers, and camera controls.
 *
 * @returns Returns scene nodes mounted inside the Three.js canvas.
 */
export function ParticleScene({ projectId, onCameraTestApiReady }: ParticleSceneProps) {
  const peers = usePeers(projectId);
  const peerTexture = useMemo(() => createPeerTexture(), []);

  for (const peer of peers) {
    if (peer.type !== "sphere") {
      throw new Error(`Unsupported peer type '${peer.type}' for peer '${peer.id}'.`);
    }
  }

  return (
    <>
      <color attach="background" args={["#020617"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 6, 3]} intensity={1.2} />
      <gridHelper args={[30, 30, "#1d4ed8", "#1e293b"]} />
      {peers.map((peer, index) => (
        <PeerSphere key={`${peer.id}-${index}`} peer={peer} texture={peerTexture} />
      ))}
      <CameraPersistenceControls projectId={projectId} onTestApiReady={onCameraTestApiReady} />
    </>
  );
}
