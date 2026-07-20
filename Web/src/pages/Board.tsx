import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flag,
  Plus,
  Timer,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Avatar, FailureTag, PriorityTag, relativeTime } from "@/components/tags";
import { WorkOrderDrawer } from "@/components/WorkOrderDrawer";
import { useSession } from "@/context/session";
import {
  getAssets,
  getWorkOrders,
  setWorkOrderStatus,
} from "@/lib/repository";
import { PRIORITY_LABELS, type Priority, type WorkOrder, type WorkOrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLUMNS: { key: WorkOrderStatus; label: string; accent: string }[] = [
  { key: "todo", label: "To Do", accent: "text-muted-foreground" },
  { key: "in_progress", label: "In Progress", accent: "text-amber-400" },
  { key: "completed", label: "Completed", accent: "text-emerald-400" },
];

export default function Board() {
  const { user, can } = useSession();
  const qc = useQueryClient();
  const [selectedWoId, setSelectedWoId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Priority | "all">("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<WorkOrderStatus | null>(null);

  const { data: assets = [] } = useQuery({ queryKey: ["assets"], queryFn: getAssets });
  const { data: workOrders = [] } = useQuery({
    queryKey: ["work_orders"],
    queryFn: getWorkOrders,
  });

  const assetMap = useMemo(
    () => Object.fromEntries(assets.map((a) => [a.id, a])),
    [assets],
  );

  const filtered = useMemo(
    () => workOrders.filter((w) => filter === "all" || w.priority === filter),
    [workOrders, filter],
  );

  const byColumn = useMemo(() => {
    const map: Record<WorkOrderStatus, WorkOrder[]> = { todo: [], in_progress: [], completed: [] };
    for (const w of filtered) map[w.status].push(w);
    for (const k of Object.keys(map) as WorkOrderStatus[]) {
      map[k].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    return map;
  }, [filtered]);

  const move = useCallback(
    async (woId: string, status: WorkOrderStatus) => {
      const wo = workOrders.find((w) => w.id === woId);
      if (!wo || wo.status === status) return;
      // Artisan moving to completed requires sign-off handled in drawer normally,
      // but allow drag for sign-off-capable roles.
      await setWorkOrderStatus(woId, status, user?.id);
      qc.invalidateQueries({ queryKey: ["work_orders"] });
      qc.invalidateQueries({ queryKey: ["asset", wo.asset_id] });
      toast.success(`Moved to ${status === "todo" ? "To Do" : status === "in_progress" ? "In Progress" : "Completed"}`);
      if (status === "completed" && wo.priority === "emergency") {
        toast.info("Log downtime minutes in the work order detail.");
      }
    },
    [workOrders, user, qc],
  );

  const counts = useMemo(
    () => ({
      todo: byColumn.todo.length,
      in_progress: byColumn.in_progress.length,
      completed: byColumn.completed.length,
    }),
    [byColumn],
  );

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/40 px-3 py-2.5 sm:px-5">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight">Work Order Board</h1>
            <div className="hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
              <span>{counts.todo} to do</span>
              <span className="text-amber-400">{counts.in_progress} active</span>
              <span className="text-emerald-400">{counts.completed} done</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Priority filter chips */}
            <div className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 p-0.5">
              {(["all", "emergency", "planned", "ci"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setFilter(p)}
                  className={cn(
                    "rounded px-2 py-1 text-[11px] font-medium transition",
                    filter === p
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p === "all" ? "All" : PRIORITY_LABELS[p].split(" ")[0]}
                </button>
              ))}
            </div>

            {can.logTicket && (
              <button
                onClick={() => setSelectedWoId("__new__")}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110 active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                New Ticket
              </button>
            )}
          </div>
        </div>

        {/* Board */}
        <div className="flex flex-1 gap-3 overflow-x-auto p-3 sm:p-5 lg:gap-4">
          {COLUMNS.map((col) => (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.key);
              }}
              onDragLeave={() => setDragOver((v) => (v === col.key ? null : v))}
              onDrop={() => {
                if (dragId) void move(dragId, col.key);
                setDragId(null);
                setDragOver(null);
              }}
              className={cn(
                "flex w-[280px] flex-none flex-col rounded-xl border bg-card/40 transition sm:w-[320px] lg:w-[340px]",
                dragOver === col.key
                  ? "border-primary/60 bg-primary/5"
                  : "border-border",
              )}
            >
              {/* Column header */}
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  {col.key === "todo" && <Flag className={cn("h-3.5 w-3.5", col.accent)} />}
                  {col.key === "in_progress" && <Timer className={cn("h-3.5 w-3.5", col.accent)} />}
                  {col.key === "completed" && <CheckCircle2 className={cn("h-3.5 w-3.5", col.accent)} />}
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {col.label}
                  </h2>
                </div>
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-secondary px-1.5 text-[10px] font-bold text-muted-foreground">
                  {byColumn[col.key].length}
                </span>
              </div>

              {/* Cards */}
              <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto p-2">
                {byColumn[col.key].length === 0 && (
                  <div className="grid h-24 place-items-center rounded-lg border border-dashed border-border/60 text-[11px] text-muted-foreground">
                    Drop here
                  </div>
                )}
                {byColumn[col.key].map((wo) => {
                  const asset = assetMap[wo.asset_id];
                  const assignee = wo.assigned_to
                    ? null // resolved in drawer; keep board light
                    : null;
                  return (
                    <div
                      key={wo.id}
                      draggable
                      onDragStart={() => setDragId(wo.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setDragOver(null);
                      }}
                      onClick={() => setSelectedWoId(wo.id)}
                      className={cn(
                        "cursor-grab rounded-lg border bg-card p-2.5 shadow-sm transition active:cursor-grabbing active:scale-[0.99] hover:border-primary/40",
                        dragId === wo.id ? "opacity-50" : "border-border",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-xs font-semibold leading-snug">
                          {wo.title}
                        </p>
                        <PriorityTag priority={wo.priority} />
                      </div>

                      {asset && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span className="rounded bg-secondary/60 px-1 py-0.5 font-mono text-[9px]">
                            {asset.code}
                          </span>
                          <span className="truncate">{asset.name.split("—")[0].trim()}</span>
                        </div>
                      )}

                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {wo.failure_category && <FailureTag category={wo.failure_category} />}
                          {wo.downtime_mins > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] font-medium text-destructive">
                              <Clock className="h-3 w-3" />
                              {wo.downtime_mins}m
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {relativeTime(wo.updated_at)}
                        </span>
                      </div>

                      {wo.assigned_to && (
                        <div className="mt-2 flex items-center gap-1.5 border-t border-border/60 pt-2">
                          {assignee ?? (
                            <span className="text-[10px] text-muted-foreground">Assigned</span>
                          )}
                          {wo.signed_off_at && (
                            <span className="ml-auto flex items-center gap-0.5 text-[10px] text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              Signed
                            </span>
                          )}
                        </div>
                      )}

                      {wo.priority === "emergency" && !wo.assigned_to && (
                        <div className="mt-2 flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-1 text-[10px] font-medium text-destructive">
                          <AlertOctagon className="h-3 w-3" />
                          Unassigned · needs triage
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Quick-add on To Do column */}
              {col.key === "todo" && can.logTicket && (
                <button
                  onClick={() => setSelectedWoId("__new__")}
                  className="m-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/70 py-2 text-[11px] font-medium text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Log breakdown
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <WorkOrderDrawer
        workOrderId={selectedWoId}
        onClose={() => setSelectedWoId(null)}
      />
    </AppLayout>
  );
}
