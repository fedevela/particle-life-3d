import { create } from "zustand";

import {
  clampHelloShaderWorldMovementParams,
  DEFAULT_HELLO_SHADER_WORLD_MOVEMENT_PARAMS,
  HELLO_SHADER_WORLD_MOVEMENT_CONTROLS,
  type HelloShaderWorldMovementParamKey,
  type HelloShaderWorldMovementParams,
} from "~/types/hello-shader-world-movement";
import {
  clampRandomWalkWorldPhysicsParams,
  clampRandomWalkWorldParams,
  DEFAULT_RANDOM_WALK_WORLD_SEED_INPUT,
  DEFAULT_RANDOM_WALK_WORLD_PHYSICS_PARAMS,
  DEFAULT_RANDOM_WALK_WORLD_PARAMS,
  RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS,
  type RandomWalkPhysicsMode,
  type RandomWalkWorldPhysicsParamKey,
  type RandomWalkWorldPhysicsParams,
  RANDOM_WALK_WORLD_PARAM_CONTROLS,
  type RandomWalkWorldParamKey,
  type RandomWalkWorldParams,
} from "~/types/random-walk-world";

type HelloShaderWorldActionType = "add" | "remove";

type HelloShaderWorldAction = {
  id: number;
  type: HelloShaderWorldActionType;
  amount: number;
};

function parseAmountInput(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.min(parsed, 1024);
}

function parseMovementParamInput(key: HelloShaderWorldMovementParamKey, rawValue: string) {
  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_HELLO_SHADER_WORLD_MOVEMENT_PARAMS[key];
  }

  const control = HELLO_SHADER_WORLD_MOVEMENT_CONTROLS[key];
  return Math.min(control.max, Math.max(control.min, parsed));
}

function parseRandomWalkParamInput(key: RandomWalkWorldParamKey, rawValue: string) {
  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_RANDOM_WALK_WORLD_PARAMS[key];
  }

  const control = RANDOM_WALK_WORLD_PARAM_CONTROLS[key];
  return Math.min(control.max, Math.max(control.min, parsed));
}

function parseRandomWalkPhysicsParamInput(key: RandomWalkWorldPhysicsParamKey, rawValue: string) {
  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_RANDOM_WALK_WORLD_PHYSICS_PARAMS[key];
  }

  const control = RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS[key];
  return Math.min(control.max, Math.max(control.min, parsed));
}

function parseRandomWalkSeedInput(rawValue: string) {
  return rawValue;
}

/** Define dashboard shell UI state shape managed in Zustand. */
type UiState = {
  /** Issue #32 ownership mapping: CH-001, CH-003. */
  issue32ArchitectureRequirementIds: readonly ["CH-001", "CH-003"];
  /** Issue #34 ownership mapping: CH-002, CH-006, CH-007, CH-009, CH-010. */
  issue34ArchitectureRequirementIds: readonly ["CH-002", "CH-006", "CH-007", "CH-009", "CH-010"];
  isExpanded: boolean;
  toggleSidebar: () => void;
  isHelloShaderWorldSubmenuOpen: boolean;
  toggleHelloShaderWorldSubmenu: () => void;
  isRandomWalkWorldSubmenuOpen: boolean;
  toggleRandomWalkWorldSubmenu: () => void;
  helloShaderWorldAmountInput: string;
  setHelloShaderWorldAmountInput: (nextAmount: string) => void;
  helloShaderWorldActionQueue: HelloShaderWorldAction[];
  queueHelloShaderWorldAction: (type: HelloShaderWorldActionType, amountOverride: string | null) => void;
  dequeueHelloShaderWorldAction: () => void;
  helloShaderWorldMovementParams: HelloShaderWorldMovementParams;
  setHelloShaderWorldMovementParam: (key: HelloShaderWorldMovementParamKey, rawValue: string) => void;
  setHelloShaderWorldMovementParams: (nextParams: HelloShaderWorldMovementParams) => void;
  randomWalkWorldParams: RandomWalkWorldParams;
  setRandomWalkWorldParam: (key: RandomWalkWorldParamKey, rawValue: string) => void;
  setRandomWalkWorldParams: (nextParams: RandomWalkWorldParams) => void;
  randomWalkWorldSeedInput: string;
  setRandomWalkWorldSeedInput: (nextSeed: string) => void;
  randomWalkWorldPhysicsParams: RandomWalkWorldPhysicsParams;
  setRandomWalkWorldPhysicsMode: (mode: RandomWalkPhysicsMode) => void;
  setRandomWalkWorldPhysicsParam: (key: RandomWalkWorldPhysicsParamKey, rawValue: string) => void;
  setRandomWalkWorldPhysicsParams: (nextParams: RandomWalkWorldPhysicsParams) => void;
};

/**
 * Expose dashboard shell UI state through a Zustand hook.
 *
 * @returns Returns the UI store hook for reading and mutating shell state.
 */
export const useUiStore = create<UiState>((set) => ({
  issue32ArchitectureRequirementIds: ["CH-001", "CH-003"],
  issue34ArchitectureRequirementIds: ["CH-002", "CH-006", "CH-007", "CH-009", "CH-010"],
  isExpanded: true,
  toggleSidebar: () => set((state) => ({ isExpanded: !state.isExpanded })),
  isHelloShaderWorldSubmenuOpen: false,
  toggleHelloShaderWorldSubmenu: () =>
    set((state) => ({
      isHelloShaderWorldSubmenuOpen: !state.isHelloShaderWorldSubmenuOpen,
    })),
  isRandomWalkWorldSubmenuOpen: false,
  toggleRandomWalkWorldSubmenu: () =>
    set((state) => ({
      isRandomWalkWorldSubmenuOpen: !state.isRandomWalkWorldSubmenuOpen,
    })),
  helloShaderWorldAmountInput: "1",
  setHelloShaderWorldAmountInput: (nextAmount) => set({ helloShaderWorldAmountInput: nextAmount }),
  helloShaderWorldActionQueue: [],
  queueHelloShaderWorldAction: (type, amountOverride) =>
    set((state) => ({
      helloShaderWorldActionQueue: [
        ...state.helloShaderWorldActionQueue,
        {
          id: (state.helloShaderWorldActionQueue.at(-1)?.id ?? 0) + 1,
          type,
          amount: parseAmountInput(amountOverride ?? state.helloShaderWorldAmountInput),
        },
      ],
    })),
  dequeueHelloShaderWorldAction: () =>
    set((state) => ({
      helloShaderWorldActionQueue: state.helloShaderWorldActionQueue.slice(1),
    })),
  helloShaderWorldMovementParams: DEFAULT_HELLO_SHADER_WORLD_MOVEMENT_PARAMS,
  setHelloShaderWorldMovementParam: (key, rawValue) =>
    set((state) => ({
      helloShaderWorldMovementParams: clampHelloShaderWorldMovementParams({
        ...state.helloShaderWorldMovementParams,
        [key]: parseMovementParamInput(key, rawValue),
      }),
    })),
  setHelloShaderWorldMovementParams: (nextParams) =>
    set({
      helloShaderWorldMovementParams: clampHelloShaderWorldMovementParams(nextParams),
    }),
  randomWalkWorldParams: clampRandomWalkWorldParams({
    ...DEFAULT_RANDOM_WALK_WORLD_PARAMS,
    dotCount: 2048,
    stepScale: 0.021,
    boundaryExtent: 10,
  }),
  setRandomWalkWorldParam: (key, rawValue) =>
    set((state) => ({
      randomWalkWorldParams: clampRandomWalkWorldParams({
        ...state.randomWalkWorldParams,
        [key]: key === "dotCount" ? Math.round(parseRandomWalkParamInput(key, rawValue)) : parseRandomWalkParamInput(key, rawValue),
      }),
    })),
  setRandomWalkWorldParams: (nextParams) =>
    set({
      randomWalkWorldParams: clampRandomWalkWorldParams(nextParams),
    }),
  randomWalkWorldSeedInput: DEFAULT_RANDOM_WALK_WORLD_SEED_INPUT,
  setRandomWalkWorldSeedInput: (nextSeed) =>
    set({
      randomWalkWorldSeedInput: parseRandomWalkSeedInput(nextSeed),
    }),
  randomWalkWorldPhysicsParams: clampRandomWalkWorldPhysicsParams({
    ...DEFAULT_RANDOM_WALK_WORLD_PHYSICS_PARAMS,
    mode: "regular-random-walk",
    ambientFriction: 0,
    peerInfluenceRadius: 2.75,
    velocityBiasWeight: 1,
    peerBiasWeight: 1,
    peerImpulseScale: 1,
  }),
  setRandomWalkWorldPhysicsMode: (mode) =>
    set((state) => ({
      randomWalkWorldPhysicsParams: clampRandomWalkWorldPhysicsParams({
        ...state.randomWalkWorldPhysicsParams,
        mode,
      }),
    })),
  setRandomWalkWorldPhysicsParam: (key, rawValue) =>
    set((state) => ({
      randomWalkWorldPhysicsParams: clampRandomWalkWorldPhysicsParams({
        ...state.randomWalkWorldPhysicsParams,
        [key]: parseRandomWalkPhysicsParamInput(key, rawValue),
      }),
    })),
  setRandomWalkWorldPhysicsParams: (nextParams) =>
    set({
      randomWalkWorldPhysicsParams: clampRandomWalkWorldPhysicsParams(nextParams),
    }),
}));
