import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge, Plus, Trash2, Wrench, X } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { useSession } from "@/context/session";
import {
  getAssets,
  getCilRoutines,
  getPmTriggers,
  saveCilRoutine,
  savePmTrigger,
} from "@/lib/repository";
import { nowIso, uid } from "@/lib/db";
import type { Cadence, CilRoutine, PmTrigger } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Pm() {
  const qc = useQueryClient();
  const { data: assets = [] } = useQuery({ queryKey: ["assets"], queryFn: getAssets });
  const { data: triggers = [] } = useQuery({ queryKey: ["pm_triggers"], queryFn: getPmTriggers });
  const { data: routines = [] } = useQuery({ queryKey: ["cil_routines"], queryFn: getCilRoutines });

  const assetMap = useMemo(
    () => Object.fromEntries(assets.map((a) => [a.id, a])),
    [assets],
  );

  const [showTrigger, setShowTrigger] = useState(false);
  const [showRoutine, setShowRoutine] = useState(false);

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/40 px-3 py-2.5 sm:px-5">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            <h1 className="text-base font-semibold">PM Schedules</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowRoutine(true)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              <Plus className="h-3.5 w-3.5" /> Routine
            </button>
            <button
              onClick={() => setShowTrigger(true)}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <Gauge className="h-3.5 w-3.5" /> Trigger
            </button>
          </div>
        </div>

        <div className="space-y-5 p-3 sm:p-5">
          {/* Runtime triggers */}
          <section>
            <div className="mb-2 flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-amber-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wide">Runtime-Hour Triggers</h2>
              <span className="text-[10px] text-muted-foreground">
                Auto-generates PM work order when crossed
              </span>
            </div>
            <div className="space-y-2">
              {triggers.map((t) => {
                const asset = assetMap[t.asset_id];
                const progress = asset
                  ? Math.min(
                      100,
                      Math.round(
                        ((asset.total_running_hours - t.last_triggered_hours) / t.interval_hours) * 100,
                      ),
                    )
                  : 0;
                const remaining = asset
                  ? t.next_trigger_hours - asset.total_running_hours
                  : 0;
                return (
                  <TriggerRow
                    key={t.id}
                    trigger={t}
                    assetCode={asset?.code ?? "—"}
                    assetName={asset?.name.split("—")[0].trim() ?? "Unknown"}
                    runningHours={asset?.total_running_hours ?? 0}
                    progress={progress}
                    remaining={remaining}
                    onSave={async (patch) => {
                      await savePmTrigger({ ...t, ...patch });
                      qc.invalidateQueries({ queryKey: ["pm_triggers"] });
                      toast.success("Trigger updated.");
                    }}
                  />
                );
              })}
              {triggers.length === 0 && (
                <div className="grid h-24 place-items-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                  No runtime triggers. Add one to auto-generate PM work orders.
                </div>
              )}
            </div>
          </section>

          {/* CIL routines */}
          <section>
            <div className="mb-2 flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5 text-sky-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wide">CIL Routines</h2>
              <span className="text-[10px] text-muted-foreground">
                Clean · Inspect · Lubricate checklists
              </span>
            </div>
            <div className="space-y-2">
              {routines.map((r) => {
                const asset = assetMap[r.asset_id];
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="grid h-9 w-9 flex-none place-items-center rounded-md bg-sky-500/15 text-sky-400">
                      <Wrench className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        <span className="font-mono">{asset?.code}</span> · {asset?.name.split("—")[0]} ·{" "}
                        {r.checklist.length} steps
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                        r.cadence === "daily"
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {r.cadence}
                    </span>
                  </div>
                );
              })}
              {routines.length === 0 && (
                <div className="grid h-24 place-items-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                  No routines yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {showTrigger && (
        <TriggerForm
          assets={assets.map((a) => ({ id: a.id, code: a.code, name: a.name.split("—")[0].trim() }))}
          onClose={() => setShowTrigger(false)}
          onSave={async (t) => {
            await savePmTrigger(t);
            qc.invalidateQueries({ queryKey: ["pm_triggers"] });
            toast.success("Trigger created.");
            setShowTrigger(false);
          }}
        />
      )}

      {showRoutine && (
        <RoutineForm
          assets={assets.map((a) => ({ id: a.id, code: a.code, name: a.name.split("—")[0].trim() }))}
          onClose={() => setShowRoutine(false)}
          onSave={async (r) => {
            await saveCilRoutine(r);
            qc.invalidateQueries({ queryKey: ["cil_routines"] });
            toast.success("Routine saved.");
            setShowRoutine(false);
          }}
        />
      )}
    </AppLayout>
  );
}

function TriggerRow({
  trigger,
  assetCode,
  assetName,
  runningHours,
  progress,
  remaining,
  onSave,
}: {
  trigger: PmTrigger;
  assetCode: string;
  assetName: string;
  runningHours: number;
  progress: number;
  remaining: number;
  onSave: (patch: Partial<PmTrigger>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [interval, setInterval] = useState(String(trigger.interval_hours));

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] font-semibold text-muted-foreground">{assetCode}</span>
            <span className="text-sm font-semibold truncate">{assetName}</span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{trigger.routine_template}</p>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className="text-[10px] font-medium text-primary hover:underline"
        >
          {editing ? "Done" : "Edit"}
        </button>
      </div>

      {/* Progress */}
      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="font-mono text-muted-foreground">
            {runningHours.toLocaleString()}h / {trigger.next_trigger_hours.toLocaleString()}h
          </span>
          <span className={cn("font-semibold", remaining <= 100 ? "text-amber-400" : "text-muted-foreground")}>
            {remaining > 0 ? `${remaining}h left` : "Due now"}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn("h-full transition-all", progress >= 100 ? "bg-primary" : "bg-amber-400")}
            style={{ width: `${Math.max(progress, 2)}%` }}
          />
        </div>
      </div>

      {editing && (
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          <label className="text-[11px] font-medium text-muted-foreground">Interval (hrs)</label>
          <input
            type="number"
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
          <button
            onClick={() => {
              const v = Number(interval);
              if (v > 0) {
                onSave({
                  interval_hours: v,
                  next_trigger_hours: trigger.last_triggered_hours + v,
                });
                setEditing(false);
              }
            }}
            className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-popover p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TriggerForm({
  assets,
  onSave,
  onClose,
}: {
  assets: { id: string; code: string; name: string }[];
  onSave: (t: PmTrigger) => void;
  onClose: () => void;
}) {
  const [assetId, setAssetId] = useState("");
  const [interval, setInterval] = useState("500");
  const [template, setTemplate] = useState("");

  return (
    <Modal title="New Runtime Trigger" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Asset">
          <select
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Interval (running hours)">
          <input
            type="number"
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="PM routine description">
          <input
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="e.g. 500-hr seal inspection"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs">Cancel</button>
          <button
            disabled={!assetId || !template.trim() || Number(interval) <= 0}
            onClick={() =>
              onSave({
                id: uid("pt-"),
                asset_id: assetId,
                interval_hours: Number(interval),
                last_triggered_hours: 0,
                next_trigger_hours: Number(interval),
                routine_template: template.trim(),
                active: true,
              })
            }
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RoutineForm({
  assets,
  onSave,
  onClose,
}: {
  assets: { id: string; code: string; name: string }[];
  onSave: (r: CilRoutine) => void;
  onClose: () => void;
}) {
  const [assetId, setAssetId] = useState("");
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState<Cadence>("daily");
  const [steps, setSteps] = useState<string[]>([""]);

  return (
    <Modal title="New CIL Routine" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Asset">
          <select
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Routine name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Daily Boiler CIL"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Cadence">
          <div className="grid grid-cols-2 gap-2">
            {(["daily", "weekly"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCadence(c)}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-xs font-medium capitalize transition",
                  cadence === c
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Checklist steps (pass/fail)">
          <div className="space-y-1.5">
            {steps.map((s, i) => (
              <div key={i} className="flex gap-1.5">
                <input
                  value={s}
                  onChange={(e) => setSteps((arr) => arr.map((x, idx) => (idx === i ? e.target.value : x)))}
                  placeholder={`Step ${i + 1}`}
                  className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
                />
                {steps.length > 1 && (
                  <button
                    onClick={() => setSteps((arr) => arr.filter((_, idx) => idx !== i))}
                    className="grid place-items-center rounded-md border border-border px-2 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setSteps((arr) => [...arr, ""])}
              className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              <Plus className="h-3 w-3" /> Add step
            </button>
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs">Cancel</button>
          <button
            disabled={!assetId || !name.trim() || steps.filter((s) => s.trim()).length === 0}
            onClick={() =>
              onSave({
                id: uid("cil-"),
                asset_id: assetId,
                name: name.trim(),
                cadence,
                checklist: steps
                  .filter((s) => s.trim())
                  .map((s, i) => ({
                    id: `s${i + 1}`,
                    prompt: s.trim(),
                    kind: "pass_fail" as const,
                  })),
                active: true,
                created_at: nowIso(),
              })
            }
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
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