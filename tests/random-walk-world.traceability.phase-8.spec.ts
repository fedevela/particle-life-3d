import { expect, test } from "@playwright/test";

import { createRandomWalkPeerInfluenceArchitecturePort } from "~/features/3d/random-walk-world/random-walk-peer-influence.architecture";
import { RandomWalkWorldSimulation } from "~/features/3d/random-walk-world/random-walk-world-simulation";
import { DEFAULT_RANDOM_WALK_WORLD_PARAMS } from "~/types/random-walk-world";

test.describe("Issue #33 phase 8 implementation traceability", () => {
  test("CH-004 ambient friction decays velocity magnitude", () => {
    const port = createRandomWalkPeerInfluenceArchitecturePort();

    const result = port.deriveAmbientFrictionDecayPlan({
      velocity: [0.5, -0.25, 0.125],
      frictionFactor: 0.4,
    });

    expect(result.decayedVelocity[0]).toBeCloseTo(0.3, 6);
    expect(result.decayedVelocity[1]).toBeCloseTo(-0.15, 6);
    expect(result.decayedVelocity[2]).toBeCloseTo(0.075, 6);
    expect(result.reachedNearHalt).toBe(false);
  });

  test("CH-004 ambient friction factor is clamped to unit interval", () => {
    const port = createRandomWalkPeerInfluenceArchitecturePort();

    const fullStop = port.deriveAmbientFrictionDecayPlan({
      velocity: [0.5, -0.25, 0.125],
      frictionFactor: 2,
    });
    expect(fullStop.decayedVelocity[0]).toBeCloseTo(0, 6);
    expect(fullStop.decayedVelocity[1]).toBeCloseTo(0, 6);
    expect(fullStop.decayedVelocity[2]).toBeCloseTo(0, 6);
    expect(fullStop.reachedNearHalt).toBe(true);

    const unchanged = port.deriveAmbientFrictionDecayPlan({
      velocity: [0.5, -0.25, 0.125],
      frictionFactor: -1,
    });
    expect(unchanged.decayedVelocity[0]).toBeCloseTo(0.5, 6);
    expect(unchanged.decayedVelocity[1]).toBeCloseTo(-0.25, 6);
    expect(unchanged.decayedVelocity[2]).toBeCloseTo(0.125, 6);
  });

  test("CH-005 neighbor average direction aggregates peers within 3D radius", () => {
    const port = createRandomWalkPeerInfluenceArchitecturePort();

    const result = port.deriveNeighborAverageDirectionPlan({
      subjectDotIndex: 0,
      neighborRadius: 1.5,
      frameDots: [
        { dotIndex: 0, position: [0, 0, 0], velocity: [0, 0, 0] },
        { dotIndex: 1, position: [1, 0, 0], velocity: [1, 0, 0] },
        { dotIndex: 2, position: [0, 1, 0], velocity: [1, 0, 0] },
        { dotIndex: 3, position: [4, 4, 0], velocity: [-1, 0, 0] },
      ],
    });

    expect(result.neighborCount).toBe(2);
    expect(result.averageDirection[0]).toBeCloseTo(1, 6);
    expect(result.averageDirection[1]).toBeCloseTo(0, 6);
    expect(result.averageDirection[2]).toBeCloseTo(0, 6);
    expect(result.usedNeutralFallback).toBe(false);
  });

  test("CH-008 dual-bias impulse combines velocity and peer directions", () => {
    const port = createRandomWalkPeerInfluenceArchitecturePort();

    const result = port.deriveDualBiasImpulseDirectionPlan({
      randomUnitDirection: [0, 0, 1],
      currentVelocityDirection: [1, 0, 0],
      peerAverageDirection: [0, 1, 0],
      velocityBiasWeight: 1,
      peerBiasWeight: 1,
    });

    expect(result.normalized).toBe(true);
    expect(result.bounded).toBe(true);
    expect(result.biasedDirection[0]).toBeGreaterThan(0);
    expect(result.biasedDirection[1]).toBeGreaterThan(0);
    expect(result.biasedDirection[2]).toBeGreaterThan(0);
  });

  test("CH-005-A physics mode toggle preserves regular mode while enabling peer-influenced variant", () => {
    const seed = "phase-8-mode-toggle-seed";
    const regular = new RandomWalkWorldSimulation(
      DEFAULT_RANDOM_WALK_WORLD_PARAMS,
      seed,
      false,
      {
        mode: "regular-random-walk",
        ambientFriction: 0.25,
        peerInfluenceRadius: 1.2,
        velocityBiasWeight: 0.5,
        peerBiasWeight: 0.5,
        peerImpulseScale: 0.15,
      },
    );
    const peerInfluenced = new RandomWalkWorldSimulation(
      DEFAULT_RANDOM_WALK_WORLD_PARAMS,
      seed,
      false,
      {
        mode: "peer-influenced-random-walk",
        ambientFriction: 0.25,
        peerInfluenceRadius: 1.2,
        velocityBiasWeight: 0.5,
        peerBiasWeight: 0.5,
        peerImpulseScale: 0.15,
      },
    );

    const regularInitial = regular.getContractTextAtFrame(0);
    const peerInitial = peerInfluenced.getContractTextAtFrame(0);
    expect(regularInitial).toBe(peerInitial);

    const regularLater = regular.getContractTextAtFrame(72);
    const peerLater = peerInfluenced.getContractTextAtFrame(72);
    expect(regularLater).not.toBe(peerLater);
  });

  test("CH-005-A frame update plan changes stages by mode", () => {
    const port = createRandomWalkPeerInfluenceArchitecturePort();

    const regular = port.deriveFrameUpdatePlan({
      mode: "regular-random-walk",
      frictionFactor: 0.2,
      peerRadius: 1.2,
      velocityBiasWeight: 0.5,
      peerBiasWeight: 0.5,
    });
    expect(regular.orderedStages).toEqual([
      "resolve-mode",
      "integrate-velocity-and-position",
      "enforce-bounded-stability",
    ]);
    expect(regular.obligationsSatisfied).toEqual(["CH-005-A"]);

    const peer = port.deriveFrameUpdatePlan({
      mode: "peer-influenced-random-walk",
      frictionFactor: 0.2,
      peerRadius: 1.2,
      velocityBiasWeight: 0.5,
      peerBiasWeight: 0.5,
    });
    expect(peer.orderedStages).toContain("apply-ambient-friction");
    expect(peer.orderedStages).toContain("compute-peer-average-direction");
    expect(peer.orderedStages).toContain("derive-dual-bias-impulse");
    expect(peer.obligationsSatisfied).toEqual(["CH-004", "CH-005", "CH-005-A", "CH-008"]);
  });
});
