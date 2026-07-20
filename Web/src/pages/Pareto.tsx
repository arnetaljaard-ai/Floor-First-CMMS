import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, BarChart3, Clock, TrendingDown } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { getAssets, getDowntimeLogs, getWorkOrders } from "@/lib/repository";
import {
  FAILURE_CATEGORY_LABELS,
  type FailureCategory,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Pareto() {
  const { data: assets = [] } = useQuery({ queryKey: ["assets"], queryFn: getAssets });
  const { data: downtime = [] } = useQuery({ queryKey: ["downtime"], queryFn: getDowntimeLogs });
  const { data: workOrders = [] } = useQuery({ queryKey: ["work_orders"], queryFn: getWorkOrders });

  const assetMap = useMemo(
    () => Object.fromEntries(assets.map((a) => [a.id, a])),
    [assets],
  );

  // Pareto by asset
  const byAsset = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of downtime) {
      map[d.asset_id] = (map[d.asset_id] ?? 0) + d.minutes;
    }
    return Object.entries(map)
      .map(([assetId, mins]) => ({
        assetId,
        name: assetMap[assetId]?.name.split("—")[0].trim() ?? "Unknown",
        code: assetMap[assetId]?.code ?? "—",
        minutes: mins,
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [downtime, assetMap]);

  const totalMins = byAsset.reduce((s, a) => s + a.minutes, 0);
  const maxMins = byAsset[0]?.minutes ?? 0;
  const paretoLine = useMemo(() => {
    let cum = 0;
    return byAsset.map((a) => {
      cum += a.minutes;
      return { pct: totalMins ? (cum / totalMins) * 100 : 0 };
    });
  }, [byAsset, totalMins]);

  const top3 = byAsset.slice(0, 3);
  const top3Share = totalMins ? (top3.reduce((s, a) => s + a.minutes, 0) / totalMins) * 100 : 0;

  // By failure category
  const byFailure = useMemo(() => {
    const map: Record<FailureCategory, number> = {
      electrical: 0,
      mechanical: 0,
      washdown_ingress: 0,
      operator_error: 0,
      other: 0,
    };
    for (const d of downtime) map[d.failure_category] += d.minutes;
    return Object.entries(map)
      .map(([k, mins]) => ({ cat: k as FailureCategory, mins }))
      .sort((a, b) => b.mins - a.mins);
  }, [downtime]);

  const maxFail = byFailure[0]?.mins ?? 0;

  // MTTR — average completion time for completed emergency WOs
  const mttr = useMemo(() => {
    const completed = workOrders.filter(
      (w) => w.status === "completed" && w.started_at && w.completed_at,
    );
    if (completed.length === 0) return 0;
    const avg = completed.reduce((s, w) => {
      const dur = new Date(w.completed_at!).getTime() - new Date(w.started_at!).getTime();
      return s + dur / 60000;
    }, 0) / completed.length;
    return Math.round(avg);
  }, [workOrders]);

  const failureColors: Record<FailureCategory, string> = {
    electrical: "bg-amber-500",
    mechanical: "bg-sky-500",
    washdown_ingress: "bg-cyan-400",
    operator_error: "bg-pink-500",
    other: "bg-muted-foreground",
  };

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="border-b border-border bg-card/40 px-3 py-2.5 sm:px-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h1 className="text-base font-semibold">Downtime & Pareto</h1>
            <span className="text-xs text-muted-foreground">{totalMins} min total</span>
          </div>
        </div>

        <div className="space-y-5 p-3 sm:p-5">
          {/* Top KPI cards */}
          <div className="grid grid-cols-3 gap-2">
            <Kpi
              label="Total downtime"
              value={`${totalMins}m`}
              sub={`${downtime.length} events`}
              icon={<Clock className="h-4 w-4" />}
            />
            <Kpi
              label="Top 3 share"
              value={`${Math.round(top3Share)}%`}
              sub="of all downtime"
              icon={<TrendingDown className="h-4 w-4" />}
              tone={top3Share >= 80 ? "amber" : "default"}
            />
            <Kpi
              label="MTTR"
              value={`${mttr}m`}
              sub="avg repair time"
              icon={<AlertOctagon className="h-4 w-4" />}
            />
          </div>

          {/* Pareto chart */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Downtime by asset</h2>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                80/20 · top 3 highlighted
              </span>
            </div>
            {byAsset.length === 0 ? (
              <div className="grid h-32 place-items-center text-sm text-muted-foreground">
                No downtime logged yet.
              </div>
            ) : (
              <div className="space-y-2">
                {byAsset.map((a, i) => {
                  const width = maxMins ? (a.minutes / maxMins) * 100 : 0;
                  const isTop3 = i < 3;
                  const cumPct = paretoLine[i]?.pct ?? 0;
                  return (
                    <div key={a.assetId}>
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-muted-foreground">{a.code}</span>
                          <span className="font-medium">{a.name}</span>
                          {isTop3 && (
                            <span className="rounded bg-primary/15 px-1 text-[9px] font-bold text-primary">
                              TOP {i + 1}
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-semibold">
                          {a.minutes}m · {Math.round(cumPct)}%
                        </span>
                      </div>
                      <div className="h-5 overflow-hidden rounded-sm bg-secondary/40">
                        <div
                          className={cn(
                            "flex h-full items-center justify-end rounded-sm pr-1.5 text-[10px] font-bold text-black transition-all",
                            isTop3 ? "bg-primary" : "bg-primary/40",
                          )}
                          style={{ width: `${Math.max(width, 8)}%` }}
                        >
                          {a.minutes}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Failure category breakdown */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">By root-cause category</h2>
            <div className="space-y-2">
              {byFailure.map((f) => {
                const width = maxFail ? (f.mins / maxFail) * 100 : 0;
                return (
                  <div key={f.cat}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="font-medium">{FAILURE_CATEGORY_LABELS[f.cat]}</span>
                      <span className="font-mono">{f.mins}m</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-sm bg-secondary/40">
                      <div
                        className={cn("h-full rounded-sm transition-all", failureColors[f.cat])}
                        style={{ width: `${Math.max(width, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  tone?: "default" | "amber";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        tone === "amber" ? "border-amber-500/40 bg-amber-500/10" : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}</div>
      <p className="mt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold leading-none">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}
