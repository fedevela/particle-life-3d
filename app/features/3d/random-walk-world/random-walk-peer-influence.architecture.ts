import {
  deriveAmbientFrictionDecayPlan,
  deriveDualBiasImpulseDirectionPlan,
  deriveFrameUpdatePlan,
  deriveNeighborAverageDirectionPlan,
} from "~/features/3d/random-walk-world/peer-influence/runtime";
import type {
  AmbientFrictionInput,
  AmbientFrictionOutput,
  DualBiasImpulseInput,
  DualBiasImpulseOutput,
  FrameUpdatePlanInput,
  FrameUpdatePlanOutput,
  NeighborAggregateInput,
  NeighborAggregateOutput,
} from "~/features/3d/random-walk-world/peer-influence/contracts";
import type { RandomWalkWorldPhysicsParams } from "~/types/random-walk-world";

export * from "~/features/3d/random-walk-world/peer-influence/contracts";

export type RandomWalkPeerInfluenceArchitecturePort = {
  deriveAmbientFrictionDecayPlan: (input: AmbientFrictionInput) => AmbientFrictionOutput;
  deriveNeighborAverageDirectionPlan: (input: NeighborAggregateInput) => NeighborAggregateOutput;
  deriveDualBiasImpulseDirectionPlan: (input: DualBiasImpulseInput) => DualBiasImpulseOutput;
  deriveFrameUpdatePlan: (input: FrameUpdatePlanInput) => FrameUpdatePlanOutput;
};

export type RandomWalkPhysicsArchitectureBindings = {
  params: RandomWalkWorldPhysicsParams;
  port: RandomWalkPeerInfluenceArchitecturePort;
};

export function createRandomWalkPeerInfluenceArchitecturePort(): RandomWalkPeerInfluenceArchitecturePort {
  return {
    deriveAmbientFrictionDecayPlan,
    deriveNeighborAverageDirectionPlan,
    deriveDualBiasImpulseDirectionPlan,
    deriveFrameUpdatePlan,
  };
}

export function createRandomWalkPhysicsArchitectureBindings(
  params: RandomWalkWorldPhysicsParams,
): RandomWalkPhysicsArchitectureBindings {
  return {
    params,
    port: createRandomWalkPeerInfluenceArchitecturePort(),
  };
}
