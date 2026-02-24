import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronFirst, ChevronLast, Sparkles } from "lucide-react";
import { NavLink, Outlet } from "react-router";

import { cn } from "~/lib/cn";
import { useUiStore } from "~/state/ui-store";

export default function DashboardShell() {
  const isExpanded = useUiStore((state) => state.isExpanded);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

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
          </nav>
        </aside>
      </Collapsible.Root>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
