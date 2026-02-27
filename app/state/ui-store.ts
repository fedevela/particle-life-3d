import { create } from "zustand";

import {
  clampHelloShaderWorldMovementParams,
  DEFAULT_HELLO_SHADER_WORLD_MOVEMENT_PARAMS,
  HELLO_SHADER_WORLD_MOVEMENT_CONTROLS,
  type HelloShaderWorldMovementParamKey,
  type HelloShaderWorldMovementParams,
} from "~/types/hello-shader-world-movement";

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

/** Define dashboard shell UI state shape managed in Zustand. */
type UiState = {
  isExpanded: boolean;
  toggleSidebar: () => void;
  isHelloShaderWorldSubmenuOpen: boolean;
  toggleHelloShaderWorldSubmenu: () => void;
  helloShaderWorldAmountInput: string;
  setHelloShaderWorldAmountInput: (nextAmount: string) => void;
  helloShaderWorldActionQueue: HelloShaderWorldAction[];
  queueHelloShaderWorldAction: (type: HelloShaderWorldActionType, amountOverride: string | null) => void;
  dequeueHelloShaderWorldAction: () => void;
  helloShaderWorldMovementParams: HelloShaderWorldMovementParams;
  setHelloShaderWorldMovementParam: (key: HelloShaderWorldMovementParamKey, rawValue: string) => void;
  setHelloShaderWorldMovementParams: (nextParams: HelloShaderWorldMovementParams) => void;
};

/**
 * Expose dashboard shell UI state through a Zustand hook.
 *
 * @returns Returns the UI store hook for reading and mutating shell state.
 */
export const useUiStore = create<UiState>((set) => ({
  isExpanded: true,
  toggleSidebar: () => set((state) => ({ isExpanded: !state.isExpanded })),
  isHelloShaderWorldSubmenuOpen: false,
  toggleHelloShaderWorldSubmenu: () =>
    set((state) => ({
      isHelloShaderWorldSubmenuOpen: !state.isHelloShaderWorldSubmenuOpen,
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
}));
