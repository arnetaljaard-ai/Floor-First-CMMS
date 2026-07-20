import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import createContextHook from "@nkzw/create-context-hook";

import { getUsers } from "@/lib/repository";
import { seedIfNeeded } from "@/lib/seed";
import type { Role, User } from "@/lib/types";

const INACTIVITY_LOCK_MS = 30_000; // 30s floor-mode auto-lock

export type Theme = "dark" | "light";

interface SessionState {
  ready: boolean;
  user: User | null;
  users: User[];
  theme: Theme;
  /** Floor Mode = kiosk PIN flow; Office = analytics layout */
  floorMode: boolean;
}

function useSessionInner() {
  const [state, setState] = useState<SessionState>({
    ready: false,
    user: null,
    users: [],
    theme: "dark",
    floorMode: true,
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const refreshUsers = useCallback(async () => {
    const users = await getUsers();
    setState((s) => ({ ...s, users }));
    return users;
  }, []);

  // Boot: seed DB, load users
  useEffect(() => {
    (async () => {
      await seedIfNeeded();
      const users = await refreshUsers();
      const savedTheme = (localStorage.getItem("cmms.theme") as Theme | null) ?? "dark";
      const savedFloor = (localStorage.getItem("cmms.floorMode") ?? "true") === "true";
      setState((s) => ({ ...s, ready: true, users, theme: savedTheme, floorMode: savedFloor }));
    })();
  }, [refreshUsers]);

  const login = useCallback(
    async (userId: string, pin: string): Promise<boolean> => {
      const users = state.users.length ? state.users : await refreshUsers();
      const u = users.find((x) => x.id === userId);
      if (!u || !u.active) {
        setAuthError("User not found.");
        return false;
      }
      if (u.pin !== pin) {
        setAuthError("Incorrect PIN.");
        return false;
      }
      setAuthError(null);
      lastActivityRef.current = Date.now();
      setState((s) => ({ ...s, user: u }));
      return true;
    },
    [state.users, refreshUsers],
  );

  const logout = useCallback(() => {
    setState((s) => ({ ...s, user: null }));
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    localStorage.setItem("cmms.theme", theme);
    setState((s) => ({ ...s, theme }));
  }, []);

  const setFloorMode = useCallback((floorMode: boolean) => {
    localStorage.setItem("cmms.floorMode", String(floorMode));
    setState((s) => ({ ...s, floorMode }));
  }, []);

  const bumpActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Auto-lock in Floor Mode after inactivity
  useEffect(() => {
    if (!state.user || !state.floorMode) return;
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > INACTIVITY_LOCK_MS) {
        setState((s) => ({ ...s, user: null }));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [state.user, state.floorMode]);

  // Apply theme class to root
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(state.theme);
  }, [state.theme]);

  // Activity listeners
  useEffect(() => {
    const handler = () => bumpActivity();
    window.addEventListener("pointerdown", handler);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [bumpActivity]);

  const can = useMemo(() => {
    const role: Role | null = state.user?.role ?? null;
    return {
      viewKanban: role === "admin" || role === "supervisor" || role === "artisan",
      viewAnalytics: role === "admin" || role === "supervisor",
      manageAssets: role === "admin" || role === "supervisor",
      manageUsers: role === "admin",
      managePm: role === "admin" || role === "supervisor",
      logTicket: true, // any logged-in role incl. operator
      approveWorkOrder: role === "admin" || role === "supervisor",
      assignWorkOrder: role === "admin" || role === "supervisor",
      runCil: true,
      signOff: role === "artisan" || role === "supervisor",
    };
  }, [state.user]);

  return {
    ...state,
    authError,
    login,
    logout,
    setTheme,
    setFloorMode,
    bumpActivity,
    refreshUsers,
    can,
  };
}

export const [SessionProvider, useSession] = createContextHook(useSessionInner);