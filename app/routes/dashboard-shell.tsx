import * as Collapsible from "@radix-ui/react-collapsible";
import { CircleDot, ChevronDown, ChevronFirst, ChevronLast, Sparkles } from "lucide-react";
import { NavLink, Outlet } from "react-router";

import { cn } from "~/lib/cn";
import { useUiStore } from "~/state/ui-store";

/**
 * Render the dashboard layout route with navigation and an outlet region.
 *
 * @returns Returns the dashboard shell layout.
 */
export default function DashboardShell() {
  const isExpanded = useUiStore((state) => state.isExpanded);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const isHelloShaderWorldSubmenuOpen = useUiStore((state) => state.isHelloShaderWorldSubmenuOpen);
  const toggleHelloShaderWorldSubmenu = useUiStore((state) => state.toggleHelloShaderWorldSubmenu);
  const helloShaderWorldAmountInput = useUiStore((state) => state.helloShaderWorldAmountInput);
  const setHelloShaderWorldAmountInput = useUiStore((state) => state.setHelloShaderWorldAmountInput);
  const queueHelloShaderWorldAction = useUiStore((state) => state.queueHelloShaderWorldAction);

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
                    id="hello-shader-world-amount"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1024}
                    step={1}
                    value={helloShaderWorldAmountInput}
                    onChange={(event) => setHelloShaderWorldAmountInput(event.target.value)}
                    className="w-full rounded-md border border-cyan-800/70 bg-slate-950/90 px-2 py-1.5 text-sm text-slate-100 outline-none ring-cyan-300/50 transition focus:ring-2"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => queueHelloShaderWorldAction("add")}
                      className="flex-1 rounded-md border border-cyan-700/80 bg-cyan-500/10 px-2 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-cyan-100 transition hover:bg-cyan-400/20"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => queueHelloShaderWorldAction("remove")}
                      className="flex-1 rounded-md border border-rose-700/70 bg-rose-500/10 px-2 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-rose-100 transition hover:bg-rose-400/20"
                    >
                      Remove
                    </button>
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
