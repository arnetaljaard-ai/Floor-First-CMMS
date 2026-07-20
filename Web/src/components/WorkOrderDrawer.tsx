import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  ImagePlus,
  PenLine,
  Send,
  Trash2,
  UserCog,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar, FailureTag, PriorityTag, relativeTime } from "@/components/tags";
import { useSession } from "@/context/session";
import {
  addWorkOrderComment,
  approveWorkOrder,
  assignWorkOrder,
  createBreakdownTicket,
  getAsset,
  getAssets,
  getUser,
  getUsers,
  getWorkOrder,
  getWorkOrderComments,
  getWorkOrderPhotos,
  saveDowntimeLog,
  saveWorkOrder,
  saveWorkOrderPhoto,
  setWorkOrderStatus,
} from "@/lib/repository";
import { nowIso, uid } from "@/lib/db";
import {
  FAILURE_CATEGORY_LABELS,
  PRIORITY_LABELS,
  type FailureCategory,
  type Priority,
  type WorkOrderStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  workOrderId: string | null;
  onClose: () => void;
}

export function WorkOrderDrawer({ workOrderId, onClose }: Props) {
  const isMobile = useIsMobile();
  const open = workOrderId !== null;
  const isNew = workOrderId === "__new__";

  return isMobile ? (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Work order</DrawerTitle>
          <DrawerDescription>View or edit work order</DrawerDescription>
        </DrawerHeader>
        {open && <Body id={workOrderId!} isNew={isNew} onClose={onClose} />}
      </DrawerContent>
    </Drawer>
  ) : (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-[480px]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Work order</SheetTitle>
          <SheetDescription>View or edit work order</SheetDescription>
        </SheetHeader>
        {open && <Body id={workOrderId!} isNew={isNew} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function Body({ id, isNew, onClose }: { id: string; isNew: boolean; onClose: () => void }) {
  const { user, can } = useSession();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  // Form state for new ticket
  const [form, setForm] = useState<{
    assetId: string;
    problem: string;
    priority: Priority;
    failureCategory: FailureCategory;
    downtimeMins: number;
  }>({ assetId: "", problem: "", priority: "emergency", failureCategory: "mechanical", downtimeMins: 0 });

  const { data: assets = [] } = useQuery({ queryKey: ["assets"], queryFn: getAssets });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: getUsers });

  const { data: wo, refetch } = useQuery({
    queryKey: ["work_order", id],
    queryFn: () => getWorkOrder(id),
    enabled: !isNew,
  });

  const { data: asset } = useQuery({
    queryKey: ["asset", wo?.asset_id],
    queryFn: () => (wo ? getAsset(wo.asset_id) : undefined),
    enabled: !!wo,
  });

  const { data: photos = [], refetch: refetchPhotos } = useQuery({
    queryKey: ["wo_photos", id],
    queryFn: () => getWorkOrderPhotos(id),
    enabled: !!wo,
  });

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ["wo_comments", id],
    queryFn: () => getWorkOrderComments(id),
    enabled: !!wo,
  });

  const assigneeName = useMemo(() => {
    const a = users.find((u) => u.id === wo?.assigned_to);
    return a;
  }, [users, wo]);

  const signeeName = useMemo(() => {
    const s = users.find((u) => u.id === wo?.signed_off_by);
    return s;
  }, [users, wo]);

  const submitTicket = useCallback(async () => {
    if (!form.assetId || !form.problem.trim()) {
      toast.error("Select asset and describe the problem.");
      return;
    }
    setBusy(true);
    const created = await createBreakdownTicket({
      assetId: form.assetId,
      problem: form.problem.trim(),
      priority: form.priority,
      failureCategory: form.failureCategory,
      downtimeMins: form.downtimeMins,
    });
    if (form.downtimeMins > 0) {
      await saveDowntimeLog({
        id: uid("dl-"),
        asset_id: form.assetId,
        work_order_id: created.id,
        failure_category: form.failureCategory,
        minutes: form.downtimeMins,
        logged_at: nowIso(),
      });
      qc.invalidateQueries({ queryKey: ["downtime"] });
    }
    qc.invalidateQueries({ queryKey: ["work_orders"] });
    qc.invalidateQueries({ queryKey: ["asset", form.assetId] });
    toast.success("Ticket logged.");
    onClose();
    setBusy(false);
  }, [form, qc, onClose]);

  const setStatus = useCallback(
    async (status: WorkOrderStatus) => {
      if (!wo) return;
      setBusy(true);
      await setWorkOrderStatus(wo.id, status, user?.id);
      await refetch();
      qc.invalidateQueries({ queryKey: ["work_orders"] });
      qc.invalidateQueries({ queryKey: ["asset", wo.asset_id] });
      toast.success(`Status: ${status.replace("_", " ")}`);
      setBusy(false);
    },
    [wo, user, refetch, qc],
  );

  const assign = useCallback(
    async (userId: string) => {
      if (!wo) return;
      await assignWorkOrder(wo.id, userId);
      await refetch();
      qc.invalidateQueries({ queryKey: ["work_orders"] });
      toast.success("Assigned.");
    },
    [wo, refetch, qc],
  );

  const approve = useCallback(async () => {
    if (!wo || !user) return;
    await approveWorkOrder(wo.id, user.id);
    await refetch();
    qc.invalidateQueries({ queryKey: ["work_orders"] });
    toast.success("Approved by supervisor.");
  }, [wo, user, refetch, qc]);

  const onPhoto = useCallback(
    async (kind: "before" | "after", file: File) => {
      if (!wo) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        await saveWorkOrderPhoto({
          id: uid("ph-"),
          work_order_id: wo.id,
          kind,
          data_url: dataUrl,
          created_at: nowIso(),
        });
        await refetchPhotos();
        toast.success(`${kind} photo added.`);
      };
      reader.readAsDataURL(file);
    },
    [wo, refetchPhotos],
  );

  const addComment = useCallback(async () => {
    if (!wo || !user || !comment.trim()) return;
    await addWorkOrderComment(wo.id, user.id, comment.trim());
    setComment("");
    await refetchComments();
  }, [wo, user, comment, refetchComments]);

  const updateDowntime = useCallback(
    async (mins: number) => {
      if (!wo) return;
      await saveWorkOrder({ ...wo, downtime_mins: mins, updated_at: nowIso() });
      await refetch();
      qc.invalidateQueries({ queryKey: ["work_orders"] });
    },
    [wo, refetch, qc],
  );

  if (isNew) {
    return (
      <NewTicketForm
        form={form}
        setForm={setForm}
        assets={assets}
        busy={busy}
        onSubmit={submitTicket}
        onClose={onClose}
      />
    );
  }

  if (!wo) return null;

  const before = photos.filter((p) => p.kind === "before");
  const after = photos.filter((p) => p.kind === "after");

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-border p-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <PriorityTag priority={wo.priority} />
            {wo.failure_category && <FailureTag category={wo.failure_category} />}
            <span className="text-[10px] text-muted-foreground">#{wo.id.slice(-5)}</span>
          </div>
          <h2 className="text-base font-semibold leading-tight text-balance">{wo.title}</h2>
          {asset && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-mono text-[10px]">{asset.code}</span> · {asset.name.split("—")[0]}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="touch-target grid place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5 p-4">
        {wo.description && (
          <p className="text-sm leading-relaxed text-foreground/90">{wo.description}</p>
        )}

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Meta label="Status" value={wo.status.replace("_", " ")} />
          <Meta label="Priority" value={PRIORITY_LABELS[wo.priority]} />
          <Meta label="Downtime" value={`${wo.downtime_mins} min`} />
          <Meta label="Created" value={relativeTime(wo.created_at)} />
        </div>

        {/* Status flow buttons */}
        <div className="flex flex-wrap gap-2">
          {wo.status !== "todo" && (
            <button
              disabled={busy || !can.assignWorkOrder}
              onClick={() => setStatus("todo")}
              className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-40"
            >
              Back to To Do
            </button>
          )}
          {wo.status === "todo" && (
            <button
              disabled={busy}
              onClick={() => setStatus("in_progress")}
              className="flex items-center gap-1 rounded-md bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/40 hover:bg-amber-500/25"
            >
              <ArrowRight className="h-3.5 w-3.5" /> Start
            </button>
          )}
          {wo.status === "in_progress" && (
            <button
              disabled={busy || !can.signOff}
              onClick={() => setStatus("completed")}
              className="flex items-center gap-1 rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/40 hover:bg-emerald-500/25 disabled:opacity-40"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Sign-off
            </button>
          )}
        </div>

        {/* Assignee */}
        {can.assignWorkOrder && wo.status !== "completed" && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Assigned to
            </p>
            <div className="flex flex-wrap gap-1.5">
              {users
                .filter((u) => u.role === "artisan" || u.role === "supervisor")
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => assign(u.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] transition",
                      wo.assigned_to === u.id
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    <Avatar name={u.full_name} color={u.avatar_color} size={18} />
                    {u.full_name.split(" ")[0]}
                  </button>
                ))}
            </div>
          </div>
        )}

        {assigneeName && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
            <Avatar name={assigneeName.full_name} color={assigneeName.avatar_color} size={26} />
            <div className="text-xs">
              <p className="font-medium">{assigneeName.full_name}</p>
              <p className="text-muted-foreground">Assigned</p>
            </div>
          </div>
        )}

        {/* Downtime editor */}
        {wo.priority === "emergency" && (
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                <Clock className="h-3.5 w-3.5" /> Downtime minutes
              </div>
              <input
                type="number"
                min={0}
                value={wo.downtime_mins}
                onChange={(e) => updateDowntime(Number(e.target.value) || 0)}
                className="w-20 rounded-md border border-border bg-background px-2 py-1 text-right text-xs"
              />
            </div>
          </div>
        )}

        {/* Photos */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Photos
          </p>
          <div className="grid grid-cols-2 gap-2">
            <PhotoSlot label="Before" photos={before} onAdd={(f) => onPhoto("before", f)} />
            <PhotoSlot label="After" photos={after} onAdd={(f) => onPhoto("after", f)} />
          </div>
        </div>

        {/* Sign-off block */}
        {wo.signed_off_at && signeeName && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <PenLine className="h-3.5 w-3.5" /> Digital Sign-off
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Avatar name={signeeName.full_name} color={signeeName.avatar_color} size={28} />
              <div className="text-xs">
                <p className="font-medium">{signeeName.full_name}</p>
                <p className="text-muted-foreground">{new Date(wo.signed_off_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Supervisor approval */}
        {can.approveWorkOrder && wo.status === "completed" && !wo.approved_at && (
          <button
            onClick={approve}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110"
          >
            <UserCog className="h-4 w-4" /> Approve & close
          </button>
        )}
        {wo.approved_at && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Approved {relativeTime(wo.approved_at)}
          </div>
        )}

        {/* Comments */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Comments
          </p>
          <div className="space-y-2">
            {comments.map((c) => {
              const u = users.find((x) => x.id === c.user_id);
              return (
                <div key={c.id} className="rounded-md border border-border bg-card/60 p-2">
                  <div className="flex items-center gap-1.5">
                    {u && <Avatar name={u.full_name} color={u.avatar_color} size={18} />}
                    <span className="text-[11px] font-semibold">{u?.full_name ?? "Unknown"}</span>
                    <span className="text-[10px] text-muted-foreground">{relativeTime(c.created_at)}</span>
                  </div>
                  <p className="mt-1 text-xs text-foreground/90">{c.text}</p>
                </div>
              );
            })}
            {comments.length === 0 && (
              <p className="text-xs text-muted-foreground">No comments yet.</p>
            )}
          </div>
          <div className="mt-2 flex gap-1.5">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
              onKeyDown={(e) => e.key === "Enter" && addComment()}
            />
            <button
              onClick={addComment}
              className="grid place-items-center rounded-md bg-secondary px-2.5 hover:bg-secondary/70"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium capitalize">{value}</p>
    </div>
  );
}

function PhotoSlot({
  label,
  photos,
  onAdd,
}: {
  label: string;
  photos: { id: string; data_url: string }[];
  onAdd: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="space-y-1.5">
        {photos.map((p) =>
          p.data_url ? (
            <img
              key={p.id}
              src={p.data_url}
              alt={`${label} photo`}
              className="aspect-square w-full rounded-md object-cover"
            />
          ) : (
            <div
              key={p.id}
              className="grid aspect-square w-full place-items-center rounded-md border border-dashed border-border bg-secondary/40 text-muted-foreground"
            >
              <FileText className="h-5 w-5" />
            </div>
          ),
        )}
        <button
          onClick={() => inputRef.current?.click()}
          className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground transition hover:border-primary/50 hover:text-primary"
        >
          <ImagePlus className="h-5 w-5" />
          <span className="text-[10px]">Add {label.toLowerCase()}</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onAdd(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function NewTicketForm({
  form,
  setForm,
  assets,
  busy,
  onSubmit,
  onClose,
}: {
  form: {
    assetId: string;
    problem: string;
    priority: Priority;
    failureCategory: FailureCategory;
    downtimeMins: number;
  };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  assets: { id: string; code: string; name: string }[];
  busy: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 className="text-base font-semibold">Log Breakdown</h2>
          <p className="text-xs text-muted-foreground">3 fields · ticket lands in To Do</p>
        </div>
        <button
          onClick={onClose}
          className="touch-target grid place-items-center rounded-md text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-4 p-4">
        {/* Asset */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Asset
          </label>
          <select
            value={form.assetId}
            onChange={(e) => setForm((f) => ({ ...f, assetId: e.target.value }))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select asset…</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name.split("—")[0].trim()}
              </option>
            ))}
          </select>
        </div>

        {/* Problem */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Problem
          </label>
          <textarea
            value={form.problem}
            onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))}
            placeholder="Describe what's wrong…"
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        {/* Priority */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Priority
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["emergency", "planned", "ci"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setForm((f) => ({ ...f, priority: p }))}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-xs font-medium transition",
                  form.priority === p
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                {PRIORITY_LABELS[p].split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Failure category */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Root cause category
          </label>
          <select
            value={form.failureCategory}
            onChange={(e) =>
              setForm((f) => ({ ...f, failureCategory: e.target.value as FailureCategory }))
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {Object.entries(FAILURE_CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* Downtime */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Downtime minutes (optional)
          </label>
          <input
            type="number"
            min={0}
            value={form.downtimeMins}
            onChange={(e) => setForm((f) => ({ ...f, downtimeMins: Number(e.target.value) || 0 }))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <button
          disabled={busy}
          onClick={onSubmit}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Logging…" : "Log Ticket"}
        </button>
      </div>
    </div>
  );
}
