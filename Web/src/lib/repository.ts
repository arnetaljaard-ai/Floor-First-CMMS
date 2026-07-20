import { getDb, nowIso, uid } from "./db";
import type {
  Asset,
  AssetFile,
  CilRoutine,
  CilRun,
  CilRunResponse,
  DowntimeLog,
  FailureCategory,
  PmTrigger,
  User,
  WorkOrder,
  WorkOrderComment,
  WorkOrderPhoto,
} from "./types";

/* ------------------------------------------------------------------ */
/* Users                                                              */
/* ------------------------------------------------------------------ */

export async function getUsers(): Promise<User[]> {
  const db = await getDb();
  return db.getAll("users");
}

export async function getUser(id: string): Promise<User | undefined> {
  const db = await getDb();
  return db.get("users", id);
}

export async function saveUser(u: User): Promise<void> {
  const db = await getDb();
  await db.put("users", u);
}

/* ------------------------------------------------------------------ */
/* Assets                                                             */
/* ------------------------------------------------------------------ */

export async function getAssets(): Promise<Asset[]> {
  const db = await getDb();
  return db.getAll("assets");
}

export async function getAsset(id: string): Promise<Asset | undefined> {
  const db = await getDb();
  return db.get("assets", id);
}

export async function getAssetByQr(qrHash: string): Promise<Asset | undefined> {
  const db = await getDb();
  return db.getFromIndex("assets", "by-qr", qrHash);
}

export async function saveAsset(a: Asset): Promise<void> {
  const db = await getDb();
  await db.put("assets", a);
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("assets", id);
}

/* ------------------------------------------------------------------ */
/* Asset files                                                        */
/* ------------------------------------------------------------------ */

export async function getAssetFiles(assetId: string): Promise<AssetFile[]> {
  const db = await getDb();
  return db.getAllFromIndex("asset_files", "by-asset", assetId);
}

export async function saveAssetFile(f: AssetFile): Promise<void> {
  const db = await getDb();
  await db.put("asset_files", f);
}

export async function deleteAssetFile(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("asset_files", id);
}

/* ------------------------------------------------------------------ */
/* Work orders                                                        */
/* ------------------------------------------------------------------ */

export async function getWorkOrders(): Promise<WorkOrder[]> {
  const db = await getDb();
  return db.getAll("work_orders");
}

export async function getWorkOrdersByAsset(assetId: string): Promise<WorkOrder[]> {
  const db = await getDb();
  return db.getAllFromIndex("work_orders", "by-asset", assetId);
}

export async function getWorkOrder(id: string): Promise<WorkOrder | undefined> {
  const db = await getDb();
  return db.get("work_orders", id);
}

export async function saveWorkOrder(w: WorkOrder): Promise<void> {
  const db = await getDb();
  await db.put("work_orders", w);
}

/**
 * Create a fast breakdown ticket from the 3-field operator form.
 */
export async function createBreakdownTicket(input: {
  assetId: string;
  problem: string;
  priority: WorkOrder["priority"];
  failureCategory?: FailureCategory;
  createdBy?: string;
  downtimeMins?: number;
}): Promise<WorkOrder> {
  const ts = nowIso();
  const wo: WorkOrder = {
    id: uid("wo-"),
    asset_id: input.assetId,
    title: input.problem.slice(0, 80) || "Breakdown reported",
    description: input.problem,
    status: "todo",
    priority: input.priority,
    failure_category: input.failureCategory,
    assigned_to: undefined,
    downtime_mins: input.downtimeMins ?? 0,
    created_at: ts,
    updated_at: ts,
  };
  await saveWorkOrder(wo);
  return wo;
}

export async function setWorkOrderStatus(
  id: string,
  status: WorkOrder["status"],
  userId?: string,
): Promise<void> {
  const wo = await getWorkOrder(id);
  if (!wo) return;
  const ts = nowIso();
  const patch: WorkOrder = { ...wo, status, updated_at: ts };
  if (status === "in_progress" && !wo.started_at) patch.started_at = ts;
  if (status === "completed") {
    patch.completed_at = ts;
    if (userId) patch.signed_off_by = userId;
    if (userId) patch.signed_off_at = ts;
  }
  await saveWorkOrder(patch);
}

export async function assignWorkOrder(id: string, userId: string): Promise<void> {
  const wo = await getWorkOrder(id);
  if (!wo) return;
  await saveWorkOrder({ ...wo, assigned_to: userId, updated_at: nowIso() });
}

export async function approveWorkOrder(id: string, supervisorId: string): Promise<void> {
  const wo = await getWorkOrder(id);
  if (!wo) return;
  await saveWorkOrder({
    ...wo,
    approved_by: supervisorId,
    approved_at: nowIso(),
    updated_at: nowIso(),
  });
}

/* ------------------------------------------------------------------ */
/* Work order photos                                                  */
/* ------------------------------------------------------------------ */

export async function getWorkOrderPhotos(workOrderId: string): Promise<WorkOrderPhoto[]> {
  const db = await getDb();
  return db.getAllFromIndex("work_order_photos", "by-wo", workOrderId);
}

export async function saveWorkOrderPhoto(p: WorkOrderPhoto): Promise<void> {
  const db = await getDb();
  await db.put("work_order_photos", p);
}

export async function deleteWorkOrderPhoto(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("work_order_photos", id);
}

/* ------------------------------------------------------------------ */
/* Work order comments                                                */
/* ------------------------------------------------------------------ */

export async function getWorkOrderComments(workOrderId: string): Promise<WorkOrderComment[]> {
  const db = await getDb();
  return db.getAllFromIndex("work_order_comments", "by-wo", workOrderId);
}

export async function addWorkOrderComment(
  workOrderId: string,
  userId: string,
  text: string,
): Promise<void> {
  const db = await getDb();
  await db.put("work_order_comments", {
    id: uid("c-"),
    work_order_id: workOrderId,
    user_id: userId,
    text,
    created_at: nowIso(),
  });
}

/* ------------------------------------------------------------------ */
/* CIL routines + runs                                                */
/* ------------------------------------------------------------------ */

export async function getCilRoutines(): Promise<CilRoutine[]> {
  const db = await getDb();
  return db.getAll("cil_routines");
}

export async function getCilRoutinesByAsset(assetId: string): Promise<CilRoutine[]> {
  const db = await getDb();
  return db.getAllFromIndex("cil_routines", "by-asset", assetId);
}

export async function getCilRoutine(id: string): Promise<CilRoutine | undefined> {
  const db = await getDb();
  return db.get("cil_routines", id);
}

export async function saveCilRoutine(r: CilRoutine): Promise<void> {
  const db = await getDb();
  await db.put("cil_routines", r);
}

export async function getCilRunsByRoutine(routineId: string): Promise<CilRun[]> {
  const db = await getDb();
  return db.getAllFromIndex("cil_runs", "by-routine", routineId);
}

/**
 * Complete a CIL run. Side-effects:
 *  - updates asset.total_running_hours if runtime_hours_entry provided
 *  - checks PM triggers; auto-generates PM work order if threshold crossed
 * Returns any generated PM work orders.
 */
export async function completeCilRun(input: {
  routineId: string;
  assetId: string;
  userId: string;
  responses: CilRunResponse[];
  runtimeHoursEntry?: number;
  notes?: string;
}): Promise<{ run: CilRun; generatedPmWorkOrders: WorkOrder[] }> {
  const db = await getDb();
  const ts = nowIso();
  const run: CilRun = {
    id: uid("crun-"),
    routine_id: input.routineId,
    asset_id: input.assetId,
    user_id: input.userId,
    started_at: ts,
    completed_at: ts,
    responses: input.responses,
    runtime_hours_entry: input.runtimeHoursEntry,
    notes: input.notes,
  };
  await db.put("cil_runs", run);

  let generated: WorkOrder[] = [];
  if (typeof input.runtimeHoursEntry === "number") {
    generated = await applyRuntimeHours(input.assetId, input.runtimeHoursEntry, input.userId);
  }
  return { run, generatedPmWorkOrders: generated };
}

/* ------------------------------------------------------------------ */
/* PM triggers                                                        */
/* ------------------------------------------------------------------ */

export async function getPmTriggers(): Promise<PmTrigger[]> {
  const db = await getDb();
  return db.getAll("pm_triggers");
}

export async function getPmTrigger(id: string): Promise<PmTrigger | undefined> {
  const db = await getDb();
  return db.get("pm_triggers", id);
}

export async function savePmTrigger(t: PmTrigger): Promise<void> {
  const db = await getDb();
  await db.put("pm_triggers", t);
}

/**
 * Apply new runtime hours to an asset and fire any crossed PM triggers.
 * If the asset's total_running_hours crosses next_trigger_hours, generate a
 * PM work order and roll the trigger forward by interval_hours.
 */
export async function applyRuntimeHours(
  assetId: string,
  newHours: number,
  assigneeId?: string,
): Promise<WorkOrder[]> {
  const db = await getDb();
  const asset = await db.get("assets", assetId);
  if (!asset) return [];
  if (newHours <= asset.total_running_hours) return []; // only monotonic forward

  const triggers = await db.getAllFromIndex("pm_triggers", "by-asset", assetId);
  const generated: WorkOrder[] = [];

  const tx = db.transaction(["assets", "pm_triggers", "work_orders"], "readwrite");

  // Update asset hours
  const updatedAsset: Asset = { ...asset, total_running_hours: newHours };
  tx.objectStore("assets").put(updatedAsset);

  for (const t of triggers) {
    if (!t.active) continue;
    if (newHours >= t.next_trigger_hours) {
      const ts = nowIso();
      const wo: WorkOrder = {
        id: uid("wo-"),
        asset_id: assetId,
        title: `PM Auto — ${t.routine_template}`,
        description: `Auto-generated by runtime trigger at ${newHours} hrs (threshold ${t.next_trigger_hours} hrs).`,
        status: "todo",
        priority: "planned",
        failure_category: "mechanical",
        assigned_to: assigneeId,
        downtime_mins: 0,
        created_at: ts,
        updated_at: ts,
      };
      tx.objectStore("work_orders").put(wo);
      generated.push(wo);

      // Roll trigger forward
      const rolled: PmTrigger = {
        ...t,
        last_triggered_hours: t.next_trigger_hours,
        next_trigger_hours: t.next_trigger_hours + t.interval_hours,
      };
      tx.objectStore("pm_triggers").put(rolled);

      // Reflect new trigger threshold on asset
      updatedAsset.next_trigger_hours = rolled.next_trigger_hours;
      tx.objectStore("assets").put(updatedAsset);
    }
  }

  await tx.done;
  return generated;
}

/* ------------------------------------------------------------------ */
/* Downtime logs                                                      */
/* ------------------------------------------------------------------ */

export async function getDowntimeLogs(): Promise<DowntimeLog[]> {
  const db = await getDb();
  return db.getAll("downtime_logs");
}

export async function getDowntimeByAsset(assetId: string): Promise<DowntimeLog[]> {
  const db = await getDb();
  return db.getAllFromIndex("downtime_logs", "by-asset", assetId);
}

export async function saveDowntimeLog(d: DowntimeLog): Promise<void> {
  const db = await getDb();
  await db.put("downtime_logs", d);
}
