import { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ClipboardList,
  Factory,
  LayoutGrid,
  LineChart,
  LogOut,
  Moon,
  QrCode,
  Settings,
  Sun,
  Users,
  Wrench,
} from "lucide-react";

import { useSession } from "@/context/session";
import { ROLE_LABELS, type Role } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  roles?: Role[]; // if omitted, all roles
}

const NAV_ITEMS: NavItem[] = [
  { to: "/board", label: "Board", icon: LayoutGrid, roles: ["admin", "supervisor", "artisan"] },
  { to: "/cil", label: "CIL", icon: ClipboardList },
  { to: "/assets", label: "Assets", icon: Factory, roles: ["admin", "supervisor"] },
  { to: "/qr", label: "QR Codes", icon: QrCode, roles: ["admin", "supervisor"] },
  { to: "/pm", label: "PM", icon: Wrench, roles: ["admin", "supervisor"] },
  { to: "/pareto", label: "Downtime", icon: LineChart, roles: ["admin", "supervisor"] },
  { to: "/admin", label: "Users", icon: Users, roles: ["admin"] },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, theme, setTheme, floorMode, setFloorMode, can } = useSession();
  const location = useLocation();

  const visibleNav = useMemo(
    () => NAV_ITEMS.filter((n) => !n.roles || (user && n.roles.includes(user.role))),
    [user],
  );

  const initials = user?.full_name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Top bar */}
      <header className="safe-pt sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/80 px-3 backdrop-blur-md sm:px-5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <Factory className="h-4 w-4 text-primary" />
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-semibold">Floor-First CMMS</p>
          </div>
          <div className="ml-1 hidden items-center gap-1 rounded-md border border-border bg-secondary/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground md:flex">
            {floorMode ? "Floor Mode" : "Office Mode"}
          </div>
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active =
              location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="touch-target grid place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {(can.viewAnalytics) && (
            <button
              onClick={() => setFloorMode(!floorMode)}
              className="hidden touch-target items-center gap-1.5 rounded-md text-[11px] font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:flex"
            >
              <Settings className="h-3.5 w-3.5" />
              {floorMode ? "Office" : "Floor"}
            </button>
          )}
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1">
            <div
              className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold text-black"
              style={{ backgroundColor: user?.avatar_color }}
            >
              {initials}
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="text-xs font-semibold">{user?.full_name}</p>
              <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[user!.role]}</p>
            </div>
            <button
              onClick={logout}
              className="touch-target grid place-items-center rounded text-muted-foreground hover:text-destructive"
              aria-label="Lock / sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden pb-16 lg:pb-0">
        {children}
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="safe-pb fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-border bg-card/95 backdrop-blur lg:hidden">
        {visibleNav.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active =
            location.pathname === item.to || location.pathname.startsWith(item.to + "/");
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
