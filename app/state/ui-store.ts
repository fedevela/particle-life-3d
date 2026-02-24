import { create } from "zustand";

type UiState = {
  isExpanded: boolean;
  toggleSidebar: () => void;
};

/**
 * Expose dashboard shell UI state through a Zustand hook.
 *
 * @returns Returns the UI store hook for reading and mutating shell state.
 */
export const useUiStore = create<UiState>((set) => ({
  isExpanded: true,
  toggleSidebar: () => set((state) => ({ isExpanded: !state.isExpanded })),
}));
