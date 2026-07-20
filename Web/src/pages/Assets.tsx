import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock, Factory, Plus, QrCode, Search } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { CriticalityTag } from "@/components/tags";
import { useSession } from "@/context/session";
import { deleteAsset, getAssets, saveAsset } from "@/lib/repository";
import { nowIso, uid } from "@/lib/db";
import { CRITICALITY_LABELS, type Asset, type Criticality } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Assets() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);

  const { data: assets = [] } = useQuery({ queryKey: ["assets"], queryFn: getAssets });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return assets;
    return assets.filter(
      (a) =>
        a.name.toLowerCase().includes(t) ||
        a.code.toLowerCase().includes(t) ||
        a.location.toLowerCase().includes(t),
    );
  }, [assets, q]);

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/40 px-3 py-2.5 sm:px-5">
          <div className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-primary" />
            <h1 className="text-base font-semibold">Asset Registry</h1>
            <span className="text-xs text-muted-foreground">{assets.length} assets</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="w-44 rounded-md border border-border bg-background pl-7 pr-2 py-1.5 text-xs sm:w-56"
              />
            </div>
            <button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((a) => {
              const hoursLeft = a.next_trigger_hours - a.total_running_hours;
              const nearTrigger = hoursLeft <= 100;
              return (
                <div
                  key={a.id}
                  className="group rounded-xl border border-border bg-card p-3 transition hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                          {a.code}
                        </span>
                        <CriticalityTag criticality={a.criticality} />
                      </div>
                      <h3 className="mt-1.5 truncate text-sm font-semibold">{a.name}</h3>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{a.location}</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditing(a);
                        setShowForm(true);
                      }}
                      className="opacity-0 transition group-hover:opacity-100 text-[10px] text-primary hover:underline"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono font-semibold">{a.total_running_hours.toLocaleString()}h</span>
                      <span className="text-muted-foreground">/ {a.next_trigger_hours.toLocaleString()}h</span>
                    </div>
                    {nearTrigger && (
                      <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        PM due
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      QR: <span className="font-mono">{a.qr_hash}</span>
                    </span>
                    <a
                      href={`#/a/${a.qr_hash}`}
                      onClick={() => {
                        window.location.assign(`/a/${a.qr_hash}`);
                      }}
                      className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                    >
                      <QrCode className="h-3 w-3" /> Hub
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="grid h-40 place-items-center text-sm text-muted-foreground">
              No assets match.
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <AssetForm
          asset={editing}
          onClose={() => setShowForm(false)}
          onSave={async (a) => {
            await saveAsset(a);
            qc.invalidateQueries({ queryKey: ["assets"] });
            toast.success("Asset saved.");
            setShowForm(false);
          }}
          onDelete={async (id) => {
            await deleteAsset(id);
            qc.invalidateQueries({ queryKey: ["assets"] });
            toast.success("Asset deleted.");
            setShowForm(false);
          }}
        />
      )}
    </AppLayout>
  );
}

function AssetForm({
  asset,
  onSave,
  onClose,
  onDelete,
}: {
  asset: Asset | null;
  onSave: (a: Asset) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState<Asset>(
    asset ?? {
      id: uid("a-"),
      name: "",
      code: "",
      location: "",
      criticality: "medium",
      qr_hash: "",
      total_running_hours: 0,
      next_trigger_hours: 500,
      notes: "",
      created_at: nowIso(),
    },
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-popover p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{asset ? "Edit Asset" : "New Asset"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="space-y-3">
          <Field label="Name">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Boiler 1 — Cleaver-Brooks CB-700"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Code">
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                placeholder="BLR-01"
              />
            </Field>
            <Field label="QR hash">
              <input
                value={form.qr_hash}
                onChange={(e) => setForm({ ...form, qr_hash: e.target.value.toUpperCase() })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                placeholder="BLR01"
              />
            </Field>
          </div>
          <Field label="Location">
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Boiler House · Bay A"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Criticality">
              <select
                value={form.criticality}
                onChange={(e) => setForm({ ...form, criticality: e.target.value as Criticality })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {Object.entries(CRITICALITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Running hours">
              <input
                type="number"
                value={form.total_running_hours}
                onChange={(e) => setForm({ ...form, total_running_hours: Number(e.target.value) || 0 })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Field label="Next PM trigger (hours)">
            <input
              type="number"
              value={form.next_trigger_hours}
              onChange={(e) => setForm({ ...form, next_trigger_hours: Number(e.target.value) || 0 })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          {asset && (
            <button
              onClick={() => onDelete(asset.id)}
              className="text-xs font-medium text-destructive hover:underline"
            >
              Delete
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(form)}
              disabled={!form.name || !form.code || !form.qr_hash}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
