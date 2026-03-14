import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";

import { createRandomWalkToroidalPhysicsPort } from "~/features/3d/random-walk-world-physics-seam";
import { useUiStore } from "~/state/ui-store";

/** Issue #32 architecture placement mapping: CH-001, CH-003. */
const ISSUE_32_RANDOM_WALK_PAGE_REQUIREMENTS = ["CH-001", "CH-003"] as const;

/**
 * Place the random-walk runtime surface in the 3D feature layer.
 * Runtime simulation behavior is intentionally deferred to a later phase.
 */
export function RandomWalkWorldPage() {
  const params = useUiStore((state) => state.randomWalkWorldParams);
  const physicsPort = useMemo(() => createRandomWalkToroidalPhysicsPort(), []);

  // Keep the declared seam linked to page-level ownership until runtime behavior binds.
  void params;
  void physicsPort;
  void ISSUE_32_RANDOM_WALK_PAGE_REQUIREMENTS;

  return (
    <section className="h-full w-full">
      <Canvas camera={{ position: [0, 0, 6], fov: 55 }}>
        <ambientLight intensity={0.75} />
      </Canvas>
    </section>
  );
}
