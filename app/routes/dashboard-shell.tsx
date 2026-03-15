import * as Collapsible from "@radix-ui/react-collapsible";
import { CircleDot, ChevronDown, ChevronFirst, ChevronLast, Orbit, Sparkles } from "lucide-react";
import { useMemo, useRef, type WheelEvent } from "react";
import { NavLink, Outlet } from "react-router";

import {
  NumericControlField,
  SelectControlField,
  TextControlField,
  applyWheelStep,
  formatValueForStep,
} from "~/features/3d/dashboard-shell/control-fields";
import { cn } from "~/lib/cn";
import {
  HELLO_SHADER_WORLD_MOVEMENT_CONTROLS,
  HELLO_SHADER_WORLD_MOVEMENT_PARAM_ORDER,
  type HelloShaderWorldMovementParamKey,
} from "~/types/hello-shader-world-movement";
import {
  RANDOM_WALK_WORLD_BOUNDARY_MODE_OPTIONS,
  RANDOM_WALK_WORLD_SEED_CONTROL,
  RANDOM_WALK_WORLD_SEED_INPUT_ID,
  RANDOM_WALK_WORLD_MENU_LABEL,
  RANDOM_WALK_WORLD_PHYSICS_MODE_OPTIONS,
  RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS,
  RANDOM_WALK_WORLD_PHYSICS_PARAM_ORDER,
  RANDOM_WALK_WORLD_PARAM_CONTROLS,
  RANDOM_WALK_WORLD_PARAM_ORDER,
  RANDOM_WALK_WORLD_ROUTE_PATH,
  type RandomWalkWorldPhysicsParamKey,
  type RandomWalkWorldParamKey,
} from "~/types/random-walk-world";
import { useUiStore } from "~/state/ui-store";

const RANDOM_WALK_MODE_LABELS: Record<(typeof RANDOM_WALK_WORLD_PHYSICS_MODE_OPTIONS)[number], string> = {
  "regular-random-walk": "Classic Random Walk",
  "peer-influenced-random-walk": "Neighbor-Aware Walk",
};
const RANDOM_WALK_BOUNDARY_MODE_LABELS: Record<(typeof RANDOM_WALK_WORLD_BOUNDARY_MODE_OPTIONS)[number], string> = {
  "wrap-around": "Wrap Around",
  "bounce-back": "Bounce Back",
  "edge-trap": "Edge Trap",
};
const DEFAULT_CONTROL_COMMIT_DELAY_MS = 3000;

function resolveControlCommitDelayMs() {
  if (typeof window === "undefined") {
    return DEFAULT_CONTROL_COMMIT_DELAY_MS;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const rawOverride = searchParams.get("uiInputDebounceMs");
  const overrideMs = rawOverride === null ? Number.NaN : Number.parseInt(rawOverride, 10);
  if (Number.isFinite(overrideMs) && overrideMs >= 0) {
    return overrideMs;
  }

  return searchParams.get("testMode") === "true" ? 0 : DEFAULT_CONTROL_COMMIT_DELAY_MS;
}

/**
 * Render the dashboard layout route with navigation and an outlet region.
 *
 * @returns Returns the dashboard shell layout.
 */
export default function DashboardShell() {
  /** Issue #32 architecture mapping: CH-001, CH-003. */
  const isExpanded = useUiStore((state) => state.isExpanded);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const isHelloShaderWorldSubmenuOpen = useUiStore((state) => state.isHelloShaderWorldSubmenuOpen);
  const toggleHelloShaderWorldSubmenu = useUiStore((state) => state.toggleHelloShaderWorldSubmenu);
  const isRandomWalkWorldSubmenuOpen = useUiStore((state) => state.isRandomWalkWorldSubmenuOpen);
  const toggleRandomWalkWorldSubmenu = useUiStore((state) => state.toggleRandomWalkWorldSubmenu);
  const helloShaderWorldAmountInput = useUiStore((state) => state.helloShaderWorldAmountInput);
  const setHelloShaderWorldAmountInput = useUiStore((state) => state.setHelloShaderWorldAmountInput);
  const queueHelloShaderWorldAction = useUiStore((state) => state.queueHelloShaderWorldAction);
  const helloShaderWorldMovementParams = useUiStore((state) => state.helloShaderWorldMovementParams);
  const setHelloShaderWorldMovementParam = useUiStore((state) => state.setHelloShaderWorldMovementParam);
  const randomWalkWorldParams = useUiStore((state) => state.randomWalkWorldParams);
  const setRandomWalkWorldParam = useUiStore((state) => state.setRandomWalkWorldParam);
  const randomWalkWorldSeedInput = useUiStore((state) => state.randomWalkWorldSeedInput);
  const setRandomWalkWorldSeedInput = useUiStore((state) => state.setRandomWalkWorldSeedInput);
  const randomWalkWorldPhysicsParams = useUiStore((state) => state.randomWalkWorldPhysicsParams);
  const setRandomWalkWorldPhysicsMode = useUiStore((state) => state.setRandomWalkWorldPhysicsMode);
  const setRandomWalkWorldBoundaryMode = useUiStore((state) => state.setRandomWalkWorldBoundaryMode);
  const setRandomWalkWorldPhysicsParam = useUiStore((state) => state.setRandomWalkWorldPhysicsParam);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const controlCommitDelayMs = useMemo(() => resolveControlCommitDelayMs(), []);

  function queueAction(type: "add" | "remove") {
    const rawAmount = amountInputRef.current?.value ?? helloShaderWorldAmountInput;
    queueHelloShaderWorldAction(type, rawAmount);
  }

  function handleAmountWheel(event: WheelEvent<HTMLInputElement>) {
    event.preventDefault();

    const current = Number.parseInt(helloShaderWorldAmountInput, 10);
    const safeCurrent = Number.isFinite(current) ? current : 1;
    const next = applyWheelStep(safeCurrent, 1, 1, 1024, event.deltaY);
    setHelloShaderWorldAmountInput(String(next));
  }

  function handleMovementWheel(key: HelloShaderWorldMovementParamKey, event: WheelEvent<HTMLInputElement>) {
    event.preventDefault();

    const control = HELLO_SHADER_WORLD_MOVEMENT_CONTROLS[key];
    const next = applyWheelStep(
      helloShaderWorldMovementParams[key],
      control.step,
      control.min,
      control.max,
      event.deltaY,
    );
    setHelloShaderWorldMovementParam(key, String(next));
  }

  function handleRandomWalkWheel(key: RandomWalkWorldParamKey, event: WheelEvent<HTMLInputElement>) {
    event.preventDefault();

    const control = RANDOM_WALK_WORLD_PARAM_CONTROLS[key];
    const next = applyWheelStep(randomWalkWorldParams[key], control.step, control.min, control.max, event.deltaY);
    setRandomWalkWorldParam(key, String(next));
  }

  function handleRandomWalkPhysicsWheel(key: RandomWalkWorldPhysicsParamKey, event: WheelEvent<HTMLInputElement>) {
    event.preventDefault();

    const control = RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS[key];
    const next = applyWheelStep(
      randomWalkWorldPhysicsParams[key],
      control.step,
      control.min,
      control.max,
      event.deltaY,
    );
    setRandomWalkWorldPhysicsParam(key, String(next));
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-slate-100">
      <Collapsible.Root open={isExpanded} className="h-full">
        <aside
          className={cn(
            "h-full border-r border-cyan-900/50 bg-slate-900/80 backdrop-blur",
            "transition-[width] duration-300",
            isExpanded ? "w-64" : "w-20",
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-cyan-900/50 px-4">
            <span className={cn("text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200", !isExpanded && "sr-only")}>
              Dashboard
            </span>
            <Collapsible.Trigger asChild>
              <button
                type="button"
                onClick={toggleSidebar}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-cyan-700/70 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-400/20"
                aria-label={isExpanded ? "Collapse navigation" : "Expand navigation"}
              >
                {isExpanded ? <ChevronFirst size={18} /> : <ChevronLast size={18} />}
              </button>
            </Collapsible.Trigger>
          </div>

          <nav className="px-3 py-4">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-cyan-400/20 text-cyan-100"
                    : "text-slate-300 hover:bg-slate-700/50 hover:text-cyan-100",
                )
              }
            >
              <Sparkles size={16} className="shrink-0" />
              <span className={cn(!isExpanded && "sr-only")}>Hello World</span>
            </NavLink>
            <div className="mt-2">
              <NavLink
                to="/hello-shader-world"
                onClick={toggleHelloShaderWorldSubmenu}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-cyan-400/20 text-cyan-100"
                      : "text-slate-300 hover:bg-slate-700/50 hover:text-cyan-100",
                  )
                }
              >
                <CircleDot size={16} className="shrink-0" />
                <span className={cn("flex-1", !isExpanded && "sr-only")}>Hello Shader World</span>
                <ChevronDown
                  size={14}
                  className={cn(
                    "shrink-0 transition-transform duration-200",
                    !isExpanded && "sr-only",
                    isHelloShaderWorldSubmenuOpen && "rotate-180",
                  )}
                />
              </NavLink>

              {isExpanded && isHelloShaderWorldSubmenuOpen ? (
                <div className="mt-2 space-y-2 rounded-lg border border-cyan-900/40 bg-slate-900/70 p-2">
                  <label className="block text-xs uppercase tracking-[0.14em] text-cyan-200" htmlFor="hello-shader-world-amount">
                    Amount
                  </label>
                  <input
                    ref={amountInputRef}
                    id="hello-shader-world-amount"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1024}
                    step={1}
                    title="How many particles Add or Remove applies."
                    value={helloShaderWorldAmountInput}
                    onChange={(event) => setHelloShaderWorldAmountInput(event.target.value)}
                    onWheel={handleAmountWheel}
                    className="w-full rounded-md border border-cyan-800/70 bg-slate-950/90 px-2 py-1.5 text-sm text-slate-100 outline-none ring-cyan-300/50 transition focus:ring-2"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => queueAction("add")}
                      className="flex-1 rounded-md border border-cyan-700/80 bg-cyan-500/10 px-2 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-cyan-100 transition hover:bg-cyan-400/20"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => queueAction("remove")}
                      className="flex-1 rounded-md border border-rose-700/70 bg-rose-500/10 px-2 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-rose-100 transition hover:bg-rose-400/20"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="space-y-2 border-t border-cyan-900/40 pt-2">
                    {HELLO_SHADER_WORLD_MOVEMENT_PARAM_ORDER.map((key) => {
                      const control = HELLO_SHADER_WORLD_MOVEMENT_CONTROLS[key];
                      return (
                        <NumericControlField
                          key={key}
                          id={`hello-shader-world-${key}`}
                          label={control.label}
                          tooltip={control.tooltip}
                          min={control.min}
                          max={control.max}
                          step={control.step}
                          value={formatValueForStep(helloShaderWorldMovementParams[key], control.step)}
                          onChange={(value) => setHelloShaderWorldMovementParam(key, value)}
                          onWheel={(event) => handleMovementWheel(key, event)}
                          commitDelayMs={controlCommitDelayMs}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-2">
              <NavLink
                to={RANDOM_WALK_WORLD_ROUTE_PATH}
                onClick={toggleRandomWalkWorldSubmenu}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-cyan-400/20 text-cyan-100"
                      : "text-slate-300 hover:bg-slate-700/50 hover:text-cyan-100",
                  )
                }
              >
                <Orbit size={16} className="shrink-0" />
                <span className={cn("flex-1", !isExpanded && "sr-only")}>{RANDOM_WALK_WORLD_MENU_LABEL}</span>
                <ChevronDown
                  size={14}
                  className={cn(
                    "shrink-0 transition-transform duration-200",
                    !isExpanded && "sr-only",
                    isRandomWalkWorldSubmenuOpen && "rotate-180",
                  )}
                />
              </NavLink>

              {isExpanded && isRandomWalkWorldSubmenuOpen ? (
                <div className="mt-2 space-y-2 rounded-lg border border-cyan-900/40 bg-slate-900/70 p-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-300">Simulation Controls</p>
                  <div className="space-y-1 border-t border-cyan-900/40 pt-2">
                    <TextControlField
                      id={RANDOM_WALK_WORLD_SEED_INPUT_ID}
                      label={RANDOM_WALK_WORLD_SEED_CONTROL.label}
                      tooltip={RANDOM_WALK_WORLD_SEED_CONTROL.tooltip}
                      placeholder={RANDOM_WALK_WORLD_SEED_CONTROL.placeholder}
                      value={randomWalkWorldSeedInput}
                      onChange={(value) => setRandomWalkWorldSeedInput(value)}
                      commitDelayMs={controlCommitDelayMs}
                    />
                  </div>
                  <div className="space-y-2 border-t border-cyan-900/40 pt-2">
                    {RANDOM_WALK_WORLD_PARAM_ORDER.map((key) => {
                      const control = RANDOM_WALK_WORLD_PARAM_CONTROLS[key];
                      return (
                        <NumericControlField
                          key={key}
                          id={`random-walk-world-${key}`}
                          label={control.label}
                          tooltip={control.tooltip}
                          min={control.min}
                          max={control.max}
                          step={control.step}
                          value={formatValueForStep(randomWalkWorldParams[key], control.step)}
                          onChange={(value) => setRandomWalkWorldParam(key, value)}
                          onWheel={(event) => handleRandomWalkWheel(key, event)}
                          commitDelayMs={controlCommitDelayMs}
                        />
                      );
                    })}
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-300">Neighbor behavior controls</p>
                  <div className="space-y-2 border-t border-cyan-900/40 pt-2">
                    <SelectControlField
                      id="random-walk-world-mode"
                      label="Physics Mode"
                      tooltip="Choose classic movement or movement that reacts to nearby neighbors."
                      value={randomWalkWorldPhysicsParams.mode}
                      onChange={(value) => setRandomWalkWorldPhysicsMode(value as typeof randomWalkWorldPhysicsParams.mode)}
                      options={RANDOM_WALK_WORLD_PHYSICS_MODE_OPTIONS.map((mode) => ({
                        value: mode,
                        label: RANDOM_WALK_MODE_LABELS[mode],
                      }))}
                      commitDelayMs={controlCommitDelayMs}
                    />
                    <SelectControlField
                      id="random-walk-world-boundaryMode"
                      label="Edge Behavior"
                      tooltip="Choose how dots behave when they reach the world edge."
                      value={randomWalkWorldPhysicsParams.boundaryMode}
                      onChange={(value) => setRandomWalkWorldBoundaryMode(value as typeof randomWalkWorldPhysicsParams.boundaryMode)}
                      options={RANDOM_WALK_WORLD_BOUNDARY_MODE_OPTIONS.map((boundaryMode) => ({
                        value: boundaryMode,
                        label: RANDOM_WALK_BOUNDARY_MODE_LABELS[boundaryMode],
                      }))}
                      commitDelayMs={controlCommitDelayMs}
                    />
                    {randomWalkWorldPhysicsParams.mode === "peer-influenced-random-walk" ? (
                      RANDOM_WALK_WORLD_PHYSICS_PARAM_ORDER.map((key) => {
                        const control = RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS[key];
                        return (
                          <NumericControlField
                            key={key}
                            id={`random-walk-world-${key}`}
                            label={control.label}
                            tooltip={control.tooltip}
                            min={control.min}
                            max={control.max}
                            step={control.step}
                            value={formatValueForStep(randomWalkWorldPhysicsParams[key], control.step)}
                            onChange={(value) => setRandomWalkWorldPhysicsParam(key, value)}
                            onWheel={(event) => handleRandomWalkPhysicsWheel(key, event)}
                            commitDelayMs={controlCommitDelayMs}
                          />
                        );
                      })
                    ) : (
                      <p className="text-[10px] uppercase tracking-[0.12em] text-cyan-300/90">
                        Neighbor controls are hidden in Classic Random Walk mode.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </nav>
        </aside>
      </Collapsible.Root>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
