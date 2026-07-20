import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Delete, Factory, Fingerprint, Keyboard, ShieldCheck } from "lucide-react";

import { useSession } from "@/context/session";
import { ROLE_LABELS, type Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const PIN_LENGTH = 4;

const ROLE_ORDER: Role[] = ["artisan", "operator", "supervisor", "admin"];

const ROLE_ACCENTS: Record<Role, string> = {
  admin: "from-amber-500/30 to-amber-500/5 ring-amber-500/40",
  supervisor: "from-sky-500/30 to-sky-500/5 ring-sky-500/40",
  artisan: "from-lime-500/30 to-lime-500/5 ring-lime-500/40",
  operator: "from-pink-500/30 to-pink-500/5 ring-pink-500/40",
};

export default function Login() {
  const { users, login, authError, ready, floorMode, setFloorMode } = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState<string>("");
  const [shake, setShake] = useState(false);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedId) ?? null,
    [users, selectedId],
  );

  const sortedUsers = useMemo(
    () =>
      [...users].sort(
        (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
      ),
    [users],
  );

  const pushDigit = useCallback(
    (d: string) => {
      setPin((p) => (p.length >= PIN_LENGTH ? p : p + d));
    },
    [],
  );

  const backspace = useCallback(() => {
    setPin((p) => p.slice(0, -1));
  }, []);

  // Auto-submit when pin complete
  useEffect(() => {
    if (!selectedId || pin.length < PIN_LENGTH) return;
    void (async () => {
      const ok = await login(selectedId, pin);
      if (!ok) {
        setShake(true);
        setPin("");
        setTimeout(() => setShake(false), 500);
      }
    })();
  }, [pin, selectedId, login]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-10 w-10 animate-pulse rounded-md bg-primary/20" />
          <p className="text-sm tracking-wide">Loading plant data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      {/* Ambient industrial backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 10%, hsl(38 92% 52% / 0.35) 0, transparent 40%), radial-gradient(circle at 85% 90%, hsl(222 80% 40% / 0.4) 0, transparent 45%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1 hazard-stripes-thin opacity-50"
      />

      {/* Header */}
      <header className="safe-pt relative z-10 flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <Factory className="h-5 w-5 text-primary" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-foreground">Floor-First CMMS</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Plant Maintenance
            </p>
          </div>
        </div>
        <button
          onClick={() => setFloorMode(!floorMode)}
          className="flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          <Keyboard className="h-3.5 w-3.5" />
          {floorMode ? "Floor" : "Office"}
        </button>
      </header>

      <main className="relative z-10 flex flex-1 flex-col px-5 pb-6 pt-6">
        {/* Avatar grid */}
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-center text-2xl font-bold tracking-tight text-balance">
            Select your profile
          </h1>
          <p className="mt-1.5 text-center text-sm text-muted-foreground">
            Tap your avatar, then enter your 4-digit floor PIN.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {sortedUsers.map((u) => {
              const selected = u.id === selectedId;
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    setSelectedId(u.id);
                    setPin("");
                  }}
                  className={cn(
                    "touch-target group relative flex flex-col items-center gap-2 overflow-hidden rounded-xl border bg-card p-3 text-center ring-1 ring-inset transition active:scale-[0.97]",
                    selected
                      ? cn("border-primary/60", ROLE_ACCENTS[u.role])
                      : "border-border ring-transparent hover:border-border/80",
                  )}
                >
                  <div
                    className="grid h-14 w-14 place-items-center rounded-full text-lg font-bold text-black ring-2 ring-white/20"
                    style={{ backgroundColor: u.avatar_color }}
                  >
                    {u.full_name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{u.full_name}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {ROLE_LABELS[u.role].split(" ")[0]}
                    </p>
                  </div>
                  {selected && (
                    <div className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* PIN pad */}
        <div
          className={cn(
            "mx-auto mt-6 w-full max-w-xs transition-all",
            selectedId ? "opacity-100" : "pointer-events-none opacity-40",
            shake && "animate-[shake_0.4s]",
          )}
          style={shake ? { animation: "shake 0.4s" } : undefined}
        >
          {/* PIN dots */}
          <div className="flex items-center justify-center gap-3">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-3.5 w-3.5 rounded-full border-2 transition",
                  i < pin.length
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40 bg-transparent",
                )}
              />
            ))}
          </div>

          {authError && (
            <p className="mt-2 text-center text-xs font-medium text-destructive">{authError}</p>
          )}

          {selectedUser && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Enter PIN for <span className="text-foreground">{selectedUser.full_name}</span>
            </p>
          )}

          {/* Keypad */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                onClick={() => pushDigit(d)}
                className="touch-target rounded-lg border border-border bg-card text-xl font-semibold text-foreground transition hover:bg-secondary active:scale-95 active:bg-primary active:text-primary-foreground"
              >
                {d}
              </button>
            ))}
            <button
              onClick={() => setSelectedId(null)}
              className="touch-target flex items-center justify-center rounded-lg border border-border bg-card/60 text-xs font-medium text-muted-foreground transition hover:text-foreground active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={() => pushDigit("0")}
              className="touch-target rounded-lg border border-border bg-card text-xl font-semibold text-foreground transition hover:bg-secondary active:scale-95 active:bg-primary active:text-primary-foreground"
            >
              0
            </button>
            <button
              onClick={backspace}
              className="touch-target flex items-center justify-center rounded-lg border border-border bg-card/60 text-muted-foreground transition hover:text-foreground active:scale-95"
            >
              <Delete className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Fingerprint className="h-3.5 w-3.5" />
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Demo PINs · Admin 1001 · Supervisor 2002 · Artisan 3003 · Operator 4004</span>
          </div>
        </div>
      </main>

      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}`}</style>
    </div>
  );
}
