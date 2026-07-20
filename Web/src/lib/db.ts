import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type {
  Asset,
  AssetFile,
  CilRoutine,
  CilRun,
  DowntimeLog,
  PmTrigger,
  SyncQueueItem,
  User,
  WorkOrder,
  WorkOrderComment,
  WorkOrderPhoto,
} from "./types";

interface CmmsDB extends DBSchema {
  users: { key: string; value: User };
  assets: { key: string; value: Asset; indexes: { "by-qr": string } };
  work_orders: {
    key: string;
    value: WorkOrder;
    indexes: { "by-asset": string; "by-status": string; "by-assignee": string };
  };
  work_order_photos: { key: string; value: WorkOrderPhoto; indexes: { "by-wo": string } };
  work_order_comments: { key: string; value: WorkOrderComment; indexes: { "by-wo": string } };
  asset_files: { key: string; value: AssetFile; indexes: { "by-asset": string } };
  cil_routines: { key: string; value: CilRoutine; indexes: { "by-asset": string } };
  cil_runs: { key: string; value: CilRun; indexes: { "by-routine": string } };
  downtime_logs: { key: string; value: DowntimeLog; indexes: { "by-asset": string } };
  pm_triggers: { key: string; value: PmTrigger; indexes: { "by-asset": string } };
  sync_queue: { key: string; value: SyncQueueItem };
  meta: { key: string; value: { key: string; value: unknown } };
}

const DB_NAME = "floor-first-cmms";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<CmmsDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<CmmsDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CmmsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("users")) {
          db.createObjectStore("users", { keyPath: "id" });
        }
        const assets = db.createObjectStore("assets", { keyPath: "id" });
        assets.createIndex("by-qr", "qr_hash", { unique: true });
        const wos = db.createObjectStore("work_orders", { keyPath: "id" });
        wos.createIndex("by-asset", "asset_id");
        wos.createIndex("by-status", "status");
        wos.createIndex("by-assignee", "assigned_to");
        const woph = db.createObjectStore("work_order_photos", { keyPath: "id" });
        woph.createIndex("by-wo", "work_order_id");
        const woc = db.createObjectStore("work_order_comments", { keyPath: "id" });
        woc.createIndex("by-wo", "work_order_id");
        const af = db.createObjectStore("asset_files", { keyPath: "id" });
        af.createIndex("by-asset", "asset_id");
        const cr = db.createObjectStore("cil_routines", { keyPath: "id" });
        cr.createIndex("by-asset", "asset_id");
        const crun = db.createObjectStore("cil_runs", { keyPath: "id" });
        crun.createIndex("by-routine", "routine_id");
        const dl = db.createObjectStore("downtime_logs", { keyPath: "id" });
        dl.createIndex("by-asset", "asset_id");
        const pt = db.createObjectStore("pm_triggers", { keyPath: "id" });
        pt.createIndex("by-asset", "asset_id");
        db.createObjectStore("sync_queue", { keyPath: "id" });
        db.createObjectStore("meta", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

export function uid(prefix = ""): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}${time}${rnd}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Reset DB (used by demo/seed reset). */
export async function resetDb(): Promise<void> {
  const db = await getDb();
  const stores = [
    "users",
    "assets",
    "work_orders",
    "work_order_photos",
    "work_order_comments",
    "asset_files",
    "cil_routines",
    "cil_runs",
    "downtime_logs",
    "pm_triggers",
    "sync_queue",
    "meta",
  ] as const;
  const tx = db.transaction(stores, "readwrite");
  await Promise.all(stores.map((s) => tx.objectStore(s).clear()));
  await tx.done;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  const row = await db.get("meta", key);
  return row?.value as T | undefined;
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.put("meta", { key, value });
}
