import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertOctagon,
  ArrowLeft,
  Clock,
  ExternalLink,
  FileText,
  Factory,
  History,
  Plus,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Avatar, CriticalityTag, FailureTag, PriorityTag, relativeTime } from "@/components/tags";
import { WorkOrderDrawer } from "@/components/WorkOrderDrawer";
import { useSession } from "@/context/session";
import {
  createBreakdownTicket,
  getAssetByQr,
  getAssetFiles,
  getCilRoutinesByAsset,
  getDowntimeByAsset,
  getWorkOrdersByAsset,
} from "@/lib/repository";
import { cn } from "@/lib/utils";

export default function AssetDetail() {
  const { qrHash = "" } = useParams();
  const { can } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [showQuickTicket, setShowQuickTicket] = useState(false);

  const { data: asset, isLoading } = useQuery({
    queryKey: ["asset-qr", qrHash],
    queryFn: () => getAssetByQr(qrHash),
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ["asset-wos", asset?.id],
    queryFn: () => (asset ? getWorkOrdersByAsset(asset.id) : []),
    enabled: !!asset,
  });

  const { data: files = [] } = useQuery({
    queryKey: ["asset-files", asset?.id],
    queryFn: () => (asset ? getAssetFiles(asset.id) : []),
    enabled: !!asset,
  });

  const { data: routines = [] } = useQuery({
    queryKey: ["asset-cil", asset?.id],
    queryFn: () => (asset ? getCilRoutinesByAsset(asset.id) : []),
    enabled: !!asset,
  });

  const { data: downtime = [] } = useQuery({
    queryKey: ["asset-downtime", asset?.id],
    queryFn: () => (asset ? getDowntimeByAsset(asset.id) : []),
    enabled: !!asset,
  });

  const openJobs = useMemo(() => workOrders.filter((w) => w.status !== "completed"), [workOrders]);
  const recentDowntime = useMemo(
    () => [...downtime].sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()).slice(0, 5),
    [downtime],
  );
  const hoursLeft = asset ? asset.next_trigger_hours - asset.total_running_hours : 0;
  const downtimeTotal = downtime.reduce((s, d) => s + d.minutes, 0);

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center text-muted-foreground">Loading asset…</div>
    );
  }

  if (!asset) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive/15 text-destructive">
          <AlertOctagon className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold">Unknown QR code</h1>
        <p className="text-sm text-muted-foreground">
          No asset is registered for code <span className="font-mono">{qrHash}</span>.
        </p>
        <Link
          to="/board"
          className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Go to board
        </Link>
      </div>
    );
  }

  const quickSubmit = async (problem: string) => {
    if (!problem.trim()) return;
    const wo = await createBreakdownTicket({
      assetId: asset.id,
      problem: problem.trim(),
      priority: "emergency",
      failureCategory: "other",
    });
    qc.invalidateQueries({ queryKey: ["asset-wos", asset.id] });
    qc.invalidateQueries({ queryKey: ["work_orders"] });
    toast.success("Breakdown logged on board.");
    setShowQuickTicket(false);
    setDrawerId(wo.id);
  };

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Hero */}
        <div className="relative overflow-hidden border-b border-border bg-card/40 px-4 pt-4 sm:px-6">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1 hazard-stripes-thin opacity-40" />
          <button
            onClick={() => navigate(-1)}
            className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 flex-none place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
              <Factory className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                  {asset.code}
                </span>
                <CriticalityTag criticality={asset.criticality} />
              </div>
              <h1 className="mt-1.5 text-lg font-bold leading-tight text-balance">{asset.name}</h1>
              <p className="text-xs text-muted-foreground">{asset.location}</p>
            </div>
          </div>

          {asset.notes && (
            <p className="mt-3 rounded-md border border-border bg-background/60 p-2.5 text-xs text-foreground/80">
              {asset.notes}
            </p>
          )}

          {/* Stats row */}
          <div className="mt-3 grid grid-cols-3 gap-2 pb-4">
            <Stat
              label="Running hours"
              value={asset.total_running_hours.toLocaleString()}
              sub={`${asset.next_trigger_hours.toLocaleString()} to PM`}
              tone={hoursLeft <= 100 ? "amber" : "default"}
            />
            <Stat
              label="Open jobs"
              value={String(openJobs.length)}
              sub={`${workOrders.length} total`}
              tone={openJobs.length > 0 ? "amber" : "default"}
            />
            <Stat
              label="Downtime"
              value={`${downtimeTotal}m`}
              sub={`${downtime.length} events`}
              tone={downtimeTotal > 180 ? "destructive" : "default"}
            />
          </div>
        </div>

        {/* Body */}
        <div className="space-y-5 p-4 sm:p-6">
          {/* Quick action */}
          {can.logTicket && (
            <button
              onClick={() => setShowQuickTicket(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-destructive/40 bg-destructive/10 py-3 text-sm font-semibold text-destructive transition hover:bg-destructive/20"
            >
              <AlertOctagon className="h-4 w-4" /> Log Breakdown
            </button>
          )}

          {/* Open jobs */}
          <Section
            icon={<Wrench className="h-3.5 w-3.5" />}
            title="Open work orders"
            count={openJobs.length}
          >
            {openJobs.length === 0 && (
              <Empty>No open jobs. Asset is in service.</Empty>
            )}
            <div className="space-y-2">
              {openJobs.map((wo) => (
                <button
                  key={wo.id}
                  onClick={() => setDrawerId(wo.id)}
                  className="block w-full rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug">{wo.title}</p>
                    <PriorityTag priority={wo.priority} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {relativeTime(wo.updated_at)}
                    {wo.downtime_mins > 0 && (
                      <span className="text-destructive">· {wo.downtime_mins}m down</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </Section>

          {/* Manuals / schematics */}
          <Section
            icon={<FileText className="h-3.5 w-3.5" />}
            title="Manuals & schematics"
            count={files.length}
          >
            {files.length === 0 && <Empty>No linked files.</Empty>}
            <div className="space-y-1.5">
              {files.map((f) => (
                <a
                  key={f.id}
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border border-border bg-card p-2.5 text-xs transition hover:border-primary/40"
                >
                  <FileText className="h-4 w-4 flex-none text-primary" />
                  <span className="flex-1 truncate font-medium">{f.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              ))}
            </div>
          </Section>

          {/* CIL routines */}
          {routines.length > 0 && (
            <Section
              icon={<Wrench className="h-3.5 w-3.5" />}
              title="CIL routines"
              count={routines.length}
            >
              <div className="space-y-1.5">
                {routines.map((r) => (
                  <Link
                    key={r.id}
                    to={`/cil?routine=${r.id}`}
                    className="flex items-center gap-2 rounded-md border border-border bg-card p-2.5 text-xs transition hover:border-primary/40"
                  >
                    <span className="flex-1 font-medium">{r.name}</span>
                    <span className="rounded bg-secondary/60 px-1.5 py-0.5 text-[10px] uppercase">
                      {r.cadence}
                    </span>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {/* Recent downtime */}
          {recentDowntime.length > 0 && (
            <Section
              icon={<History className="h-3.5 w-3.5" />}
              title="Recent downtime"
              count={recentDowntime.length}
            >
              <div className="space-y-1.5">
                {recentDowntime.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 rounded-md border border-border bg-card p-2.5 text-xs">
                    <FailureTag category={d.failure_category} />
                    <span className="font-semibold text-destructive">{d.minutes}m</span>
                    <span className="ml-auto text-muted-foreground">{relativeTime(d.logged_at)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      <WorkOrderDrawer workOrderId={drawerId} onClose={() => setDrawerId(null)} />

      {showQuickTicket && (
        <QuickTicket assetName={asset.name} onSubmit={quickSubmit} onClose={() => setShowQuickTicket(false)} />
      )}
    </AppLayout>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "default" | "amber" | "destructive";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-2.5",
        tone === "amber" && "border-amber-500/40 bg-amber-500/10",
        tone === "destructive" && "border-destructive/40 bg-destructive/10",
        tone === "default" && "border-border bg-card",
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-xs font-semibold uppercase tracking-wide">{title}</h2>
        <span className="grid h-4 min-w-4 place-items-center rounded-full bg-secondary px-1 text-[10px] font-bold text-muted-foreground">
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-20 place-items-center rounded-lg border border-dashed border-border/60 text-[11px] text-muted-foreground">
      {children}
    </div>
  );
}

function QuickTicket({
  assetName,
  onSubmit,
  onClose,
}: {
  assetName: string;
  onSubmit: (problem: string) => void;
  onClose: () => void;
}) {
  const [problem, setProblem] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-popover p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Log Breakdown</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Asset: <span className="font-medium text-foreground">{assetName}</span>
        </p>
        <textarea
          autoFocus
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder="What's wrong? (1-2 sentences)"
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs">Cancel</button>
          <button
            onClick={() => onSubmit(problem)}
            disabled={!problem.trim()}
            className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Log it
          </button>
        </div>
      </div>
    </div>
  );
}
