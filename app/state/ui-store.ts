import { create } from "zustand";

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

/** Define dashboard shell UI state shape managed in Zustand. */
type UiState = {
  isExpanded: boolean;
  toggleSidebar: () => void;
  isHelloShaderWorldSubmenuOpen: boolean;
  toggleHelloShaderWorldSubmenu: () => void;
  helloShaderWorldAmountInput: string;
  setHelloShaderWorldAmountInput: (nextAmount: string) => void;
  helloShaderWorldActionQueue: HelloShaderWorldAction[];
  queueHelloShaderWorldAction: (type: HelloShaderWorldActionType) => void;
  dequeueHelloShaderWorldAction: () => void;
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
  queueHelloShaderWorldAction: (type) =>
    set((state) => ({
      helloShaderWorldActionQueue: [
        ...state.helloShaderWorldActionQueue,
        {
          id: (state.helloShaderWorldActionQueue.at(-1)?.id ?? 0) + 1,
          type,
          amount: parseAmountInput(state.helloShaderWorldAmountInput),
        },
      ],
    })),
  dequeueHelloShaderWorldAction: () =>
    set((state) => ({
      helloShaderWorldActionQueue: state.helloShaderWorldActionQueue.slice(1),
    })),
}));
