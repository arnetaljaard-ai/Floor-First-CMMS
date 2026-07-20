import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCcw, Users as UsersIcon, X } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Avatar } from "@/components/tags";
import { useSession } from "@/context/session";
import { getUsers, saveUser } from "@/lib/repository";
import { nowIso, uid } from "@/lib/db";
import { reseed } from "@/lib/seed";
import { ROLE_LABELS, type Role, type User } from "@/lib/types";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = ["#f59e0b", "#38bdf8", "#a3e635", "#f472b6", "#a78bfa", "#fb7185", "#34d399", "#60a5fa"];

export default function Admin() {
  const qc = useQueryClient();
  const { refreshUsers } = useSession();
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const sorted = useMemo(
    () =>
      [...users].sort(
        (a, b) =>
          (["admin", "supervisor", "artisan", "operator"] as Role[]).indexOf(a.role) -
          (["admin", "supervisor", "artisan", "operator"] as Role[]).indexOf(b.role),
      ),
    [users],
  );

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/40 px-3 py-2.5 sm:px-5">
          <div className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4 text-primary" />
            <h1 className="text-base font-semibold">User Management</h1>
            <span className="text-xs text-muted-foreground">{users.length} users</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={async () => {
                if (!confirm("Reset all demo data to seed state? This wipes changes.")) return;
                await reseed();
                await refreshUsers();
                qc.invalidateQueries();
                toast.success("Demo data reset.");
              }}
              className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset demo
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> New user
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-5">
          <div className="mx-auto max-w-3xl space-y-2">
            {sorted.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <Avatar name={u.full_name} color={u.avatar_color} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{u.full_name}</p>
                  <p className="text-[11px] text-muted-foreground">{ROLE_LABELS[u.role]}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-md border border-border bg-secondary/40 px-2 py-1 text-[11px] font-mono">
                    PIN · {u.pin}
                  </div>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                      u.active ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {u.active ? "Active" : "Off"}
                  </span>
                  <button
                    onClick={() => {
                      setEditing(u);
                      setShowForm(true);
                    }}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showForm && (
        <UserForm
          user={editing}
          onClose={() => setShowForm(false)}
          onSave={async (u) => {
            await saveUser(u);
            await refreshUsers();
            qc.invalidateQueries({ queryKey: ["users"] });
            toast.success("User saved.");
            setShowForm(false);
          }}
        />
      )}
    </AppLayout>
  );
}

function UserForm({
  user,
  onSave,
  onClose,
}: {
  user: User | null;
  onSave: (u: User) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<User>(
    user ?? {
      id: uid("u-"),
      full_name: "",
      role: "operator",
      pin: "0000",
      avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      active: true,
      created_at: nowIso(),
    },
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-popover p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{user ? "Edit User" : "New User"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Full name
            </span>
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Jane Doe"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Role
              </span>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                PIN (4 digits)
              </span>
              <input
                value={form.pin}
                maxLength={4}
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              />
            </label>
          </div>
          <div>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Avatar color
            </span>
            <div className="flex flex-wrap gap-1.5">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, avatar_color: c })}
                  className={cn(
                    "h-7 w-7 rounded-full ring-2 transition",
                    form.avatar_color === c ? "ring-foreground" : "ring-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active (can log in)
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs">Cancel</button>
          <button
            disabled={!form.full_name.trim() || form.pin.length !== 4}
            onClick={() => onSave(form)}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
