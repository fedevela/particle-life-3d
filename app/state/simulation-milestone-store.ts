import { create } from "zustand";

type SimulationMilestoneState = {
  currentFrame: number;
  isSyncing: boolean;
  lastSavedMilestone: string | null;
  lastSavedFrame: number | null;
  setCurrentFrame: (nextFrame: number) => void;
  setSyncing: (nextSyncing: boolean) => void;
  setLastSavedMilestone: (milestoneId: string, frame: number) => void;
  reset: () => void;
};

export const useSimulationMilestoneStore = create<SimulationMilestoneState>((set) => ({
  currentFrame: 0,
  isSyncing: false,
  lastSavedMilestone: null,
  lastSavedFrame: null,
  setCurrentFrame: (nextFrame) => set({ currentFrame: nextFrame }),
  setSyncing: (nextSyncing) => set({ isSyncing: nextSyncing }),
  setLastSavedMilestone: (milestoneId, frame) =>
    set({
      lastSavedMilestone: milestoneId,
      lastSavedFrame: frame,
    }),
  reset: () =>
    set({
      currentFrame: 0,
      isSyncing: false,
      lastSavedMilestone: null,
      lastSavedFrame: null,
    }),
}));
