import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Flag,
  Gauge,
  ListChecks,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { useSession } from "@/context/session";
import {
  completeCilRun,
  getAssets,
  getCilRoutines,
  getCilRunsByRoutine,
} from "@/lib/repository";
import type { CilRoutine, CilRunResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Cil() {
  const [params, setParams] = useSearchParams();
  const activeRoutineId = params.get("routine") ?? null;

  const { data: routines = [] } = useQuery({ queryKey: ["cil_routines"], queryFn: getCilRoutines });
  const { data: assets = [] } = useQuery({ queryKey: ["assets"], queryFn: getAssets });

  const assetMap = useMemo(
    () => Object.fromEntries(assets.map((a) => [a.id, a])),
    [assets],
  );

  const activeRoutine = useMemo(
    () => routines.find((r) => r.id === activeRoutineId) ?? null,
    [routines, activeRoutineId],
  );

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-card/40 px-3 py-2.5 sm:px-5">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h1 className="text-base font-semibold">CIL Routines</h1>
            <span className="text-xs text-muted-foreground">{routines.length} active</span>
          </div>
          <div className="hidden items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground sm:flex">
            <span className="rounded bg-secondary/60 px-1.5 py-0.5">Clean</span>
            <span className="rounded bg-secondary/60 px-1.5 py-0.5">Inspect</span>
            <span className="rounded bg-secondary/60 px-1.5 py-0.5">Lubricate</span>
          </div>
        </div>

        {!activeRoutine ? (
          <RoutineList routines={routines} assetMap={assetMap} onOpen={(id) => setParams({ routine: id })} />
        ) : (
          <RoutineRunner
            routine={activeRoutine}
            assetName={assetMap[activeRoutine.asset_id]?.name ?? "Asset"}
            assetCode={assetMap[activeRoutine.asset_id]?.code ?? ""}
            onExit={() => setParams({})}
          />
        )}
      </div>
    </AppLayout>
  );
}

function RoutineList({
  routines,
  assetMap,
  onOpen,
}: {
  routines: CilRoutine[];
  assetMap: Record<string, { name: string; code: string }>;
  onOpen: (id: string) => void;
}) {
  const sorted = useMemo(
    () =>
      [...routines].sort((a, b) => {
        if (a.cadence !== b.cadence) return a.cadence === "daily" ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [routines],
  );

  const daily = sorted.filter((r) => r.cadence === "daily");
  const weekly = sorted.filter((r) => r.cadence === "weekly");

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5">
      <div className="mx-auto max-w-2xl space-y-5">
        <Group label="Today" icon={<Clock className="h-3.5 w-3.5" />} routines={daily} assetMap={assetMap} onOpen={onOpen} />
        {weekly.length > 0 && (
          <Group label="This week" icon={<Flag className="h-3.5 w-3.5" />} routines={weekly} assetMap={assetMap} onOpen={onOpen} />
        )}
      </div>
    </div>
  );
}

function Group({
  label,
  icon,
  routines,
  assetMap,
  onOpen,
}: {
  label: string;
  icon: React.ReactNode;
  routines: CilRoutine[];
  assetMap: Record<string, { name: string; code: string }>;
  onOpen: (id: string) => void;
}) {
  if (routines.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="space-y-2">
        {routines.map((r) => {
          const asset = assetMap[r.asset_id];
          return (
            <button
              key={r.id}
              onClick={() => onOpen(r.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary/40 active:scale-[0.99]"
            >
              <div className="grid h-9 w-9 flex-none place-items-center rounded-md bg-primary/15 text-primary">
                <ListChecks className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  <span className="font-mono">{asset?.code}</span> · {asset?.name.split("—")[0]}
                </p>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.checklist.length} steps</span>
                <span className="rounded bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium">{r.cadence}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RoutineRunner({
  routine,
  assetName,
  assetCode,
  onExit,
}: {
  routine: CilRoutine;
  assetName: string;
  assetCode: string;
  onExit: () => void;
}) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [stepIdx, setStepIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, CilRunResponse["value"]>>({});
  const [runtimeHours, setRuntimeHours] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const { data: pastRuns = [], refetch } = useQuery({
    queryKey: ["cil_runs", routine.id],
    queryFn: () => getCilRunsByRoutine(routine.id),
  });

  useEffect(() => {
    // Reset state on routine change
    setStepIdx(0);
    setResponses({});
    setRuntimeHours("");
    setNotes("");
    setDone(false);
  }, [routine.id]);

  const totalSteps = routine.checklist.length;
  const step = routine.checklist[stepIdx];
  const isLast = stepIdx === totalSteps - 1;
  const progress = Math.round((stepIdx / totalSteps) * 100);

  const setVal = (val: CilRunResponse["value"]) => {
    setResponses((r) => ({ ...r, [step.id]: val }));
  };

  const next = () => {
    if (isLast) return;
    setStepIdx((i) => i + 1);
  };
  const prev = () => setStepIdx((i) => Math.max(0, i - 1));

  const allAnswered = routine.checklist.every((s) => {
    const v = responses[s.id];
    return v !== undefined && v !== null && v !== "";
  });

  const submit = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const respArr: CilRunResponse[] = routine.checklist.map((s) => ({
      step_id: s.id,
      value: responses[s.id] ?? null,
    }));
    const rt = runtimeHours.trim() ? Number(runtimeHours) : undefined;
    const { generatedPmWorkOrders } = await completeCilRun({
      routineId: routine.id,
      assetId: routine.asset_id,
      userId: user.id,
      responses: respArr,
      runtimeHoursEntry: rt,
      notes: notes.trim() || undefined,
    });
    await refetch();
    qc.invalidateQueries({ queryKey: ["assets"] });
    qc.invalidateQueries({ queryKey: ["asset", routine.asset_id] });
    qc.invalidateQueries({ queryKey: ["work_orders"] });
    qc.invalidateQueries({ queryKey: ["pm_triggers"] });
    qc.invalidateQueries({ queryKey: ["cil_routines"] });
    setBusy(false);
    setDone(true);
    if (generatedPmWorkOrders.length > 0) {
      toast.success(`CIL saved · ${generatedPmWorkOrders.length} PM work order(s) auto-generated by runtime trigger.`, {
        duration: 6000,
      });
    } else {
      toast.success("CIL routine completed.");
    }
  }, [user, routine, responses, runtimeHours, notes, refetch, qc]);

  if (done) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-lg font-bold">Routine complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">{routine.name}</p>
        <div className="mt-6 flex gap-2">
          <button
            onClick={onExit}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Back to routines
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card/40 px-3 py-2.5 sm:px-5">
        <button onClick={onExit} className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Exit
        </button>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">{routine.name}</h1>
            <p className="text-[11px] text-muted-foreground">
              <span className="font-mono">{assetCode}</span> · {assetName.split("—")[0]}
            </p>
          </div>
          <div className="text-right text-[10px] text-muted-foreground">
            <p>Step {stepIdx + 1} / {totalSteps}</p>
            <p className="mt-0.5">{pastRuns.length} past runs</p>
          </div>
        </div>
        {/* Progress */}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-md">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              {step.kind === "pass_fail" && <Check className="h-3 w-3" />}
              {step.kind === "numeric" && <Gauge className="h-3 w-3" />}
              {step.kind === "photo" && <Camera className="h-3 w-3" />}
              {step.kind === "pass_fail" ? "Pass / Fail" : step.kind === "numeric" ? "Reading" : "Photo"}
            </div>
            <h2 className="mt-2 text-base font-semibold leading-snug text-balance">{step.prompt}</h2>

            {step.guide && (
              <div className="mt-2.5 rounded-md border border-primary/30 bg-primary/5 p-2.5 text-xs leading-relaxed text-foreground/80">
                <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  <Sparkles className="h-3 w-3" /> Guide
                </div>
                {step.guide}
              </div>
            )}

            <div className="mt-4">
              {step.kind === "pass_fail" && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setVal(true)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border-2 py-3 text-sm font-semibold transition",
                      responses[step.id] === true
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-400"
                        : "border-border text-muted-foreground hover:border-emerald-500/40",
                    )}
                  >
                    <Check className="h-4 w-4" /> Pass
                  </button>
                  <button
                    onClick={() => setVal(false)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border-2 py-3 text-sm font-semibold transition",
                      responses[step.id] === false
                        ? "border-destructive bg-destructive/15 text-destructive"
                        : "border-border text-muted-foreground hover:border-destructive/40",
                    )}
                  >
                    <X className="h-4 w-4" /> Fail
                  </button>
                </div>
              )}

              {step.kind === "numeric" && (
                <div>
                  <div className="flex items-baseline gap-2">
                    <input
                      autoFocus
                      type="number"
                      value={(responses[step.id] as string) ?? ""}
                      onChange={(e) => setVal(e.target.value)}
                      placeholder="Enter value"
                      className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-lg font-semibold"
                    />
                    {step.unit && (
                      <span className="text-sm font-medium text-muted-foreground">{step.unit}</span>
                    )}
                  </div>
                  {step.min !== undefined && step.max !== undefined && (() => {
                    const v = Number(responses[step.id]);
                    const parsed = !isNaN(v);
                    const inRange = parsed && v >= step.min! && v <= step.max!;
                    return parsed ? (
                      <p className={cn("mt-2 text-xs font-medium", inRange ? "text-emerald-400" : "text-destructive")}>
                        {inRange ? "✓ Within range" : `Outside range ${step.min}–${step.max}`}
                      </p>
                    ) : null;
                  })()}
                </div>
              )}

              {step.kind === "photo" && (
                <PhotoStep value={responses[step.id] as string} onChange={setVal} />
              )}
            </div>
          </div>

          {/* Runtime-hour entry — only on numeric step whose unit is hours */}
          {step.kind === "numeric" && step.unit === "hours" && (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                <Gauge className="h-3.5 w-3.5" /> Asset runtime hours (drives PM triggers)
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Confirm the value above is the asset's total running hours. On submit, the system checks PM triggers and auto-generates work orders if crossed.
              </p>
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={runtimeHours === (responses[step.id] as string)}
                  onChange={(e) => setRuntimeHours(e.target.checked ? (responses[step.id] as string) ?? "" : "")}
                />
                Use this as asset runtime hours
              </label>
            </div>
          )}

          {/* Notes */}
          {isLast && (
            <div className="mt-3">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Any observations for this run…"
              />
            </div>
          )}

          {/* Nav */}
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              onClick={prev}
              disabled={stepIdx === 0}
              className="rounded-md border border-border px-3 py-2 text-xs font-medium disabled:opacity-40"
            >
              Prev
            </button>
            {!isLast ? (
              <button
                onClick={next}
                disabled={responses[step.id] === undefined || responses[step.id] === null || responses[step.id] === ""}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
              >
                Next step <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={busy || !allAnswered}
                className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {busy ? "Submitting…" : "Complete run"}
              </button>
            )}
          </div>
          {isLast && !allAnswered && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Answer all steps to complete the run.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PhotoStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => onChange(reader.result as string);
          reader.readAsDataURL(f);
        }}
      />
      {value ? (
        <div className="relative">
          <img src={value} alt="capture" className="aspect-video w-full rounded-md object-cover" />
          <button
            onClick={() => onChange("")}
            className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
        >
          <Camera className="h-6 w-6" />
          <span className="text-xs font-medium">Take photo</span>
        </button>
      )}
    </div>
  );
}
