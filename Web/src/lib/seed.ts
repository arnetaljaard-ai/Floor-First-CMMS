import { getDb, setMeta, uid, nowIso } from "./db";
import type {
  Asset,
  AssetFile,
  CilRoutine,
  CilRun,
  DowntimeLog,
  PmTrigger,
  User,
  WorkOrder,
  WorkOrderPhoto,
} from "./types";

const SEED_FLAG = "seeded_v1";

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}

const USERS: User[] = [
  {
    id: "u-admin",
    full_name: "Priya Anand",
    role: "admin",
    pin: "1001",
    avatar_color: "#f59e0b",
    active: true,
    created_at: daysAgo(120),
  },
  {
    id: "u-supervisor",
    full_name: "Marcus Reid",
    role: "supervisor",
    pin: "2002",
    avatar_color: "#38bdf8",
    active: true,
    created_at: daysAgo(120),
  },
  {
    id: "u-artisan",
    full_name: "Devon Cole",
    role: "artisan",
    pin: "3003",
    avatar_color: "#a3e635",
    active: true,
    created_at: daysAgo(120),
  },
  {
    id: "u-operator",
    full_name: "Lina Okafor",
    role: "operator",
    pin: "4004",
    avatar_color: "#f472b6",
    active: true,
    created_at: daysAgo(120),
  },
];

const ASSETS: Asset[] = [
  {
    id: "a-boiler1",
    name: "Boiler 1 — Cleaver-Brooks CB-700",
    code: "BLR-01",
    location: "Boiler House · Bay A",
    criticality: "critical",
    qr_hash: "BLR01",
    total_running_hours: 4820,
    next_trigger_hours: 5000,
    notes: "Primary steam boiler — 700 HP. Sight glass pH target 10.5–11.5.",
    created_at: daysAgo(120),
  },
  {
    id: "a-stuffer2",
    name: "Stuffer 2 — Reiser Vemag VR200",
    code: "STF-02",
    location: "Processing Line 2",
    criticality: "high",
    qr_hash: "STF02",
    total_running_hours: 3120,
    next_trigger_hours: 3500,
    notes: "Vacuum stuffer — hydraulic seal prone to washdown ingress.",
    created_at: daysAgo(120),
  },
  {
    id: "a-coldroom3",
    name: "Cold Room 3 — Blast Chiller",
    code: "CR-03",
    location: "Cold Storage · West",
    criticality: "critical",
    qr_hash: "CR03",
    total_running_hours: 8640,
    next_trigger_hours: 9000,
    notes: "Maintain −18°C. Evaporator coil defrost every shift.",
    created_at: daysAgo(120),
  },
  {
    id: "a-feedpump",
    name: "Boiler Feed Pump — Goulds 3196",
    code: "FP-01",
    location: "Boiler House · Bay A",
    criticality: "critical",
    qr_hash: "FP01",
    total_running_hours: 4780,
    next_trigger_hours: 5000,
    notes: "Seal inspection at 500 running-hour intervals.",
    created_at: daysAgo(120),
  },
  {
    id: "a-conveyor4",
    name: "Conveyor 4 — Intralox 1100",
    code: "CV-04",
    location: "Packaging Line",
    criticality: "medium",
    qr_hash: "CV04",
    total_running_hours: 2240,
    next_trigger_hours: 2500,
    notes: "Belt tracking drift after wet sanitise cycles.",
    created_at: daysAgo(120),
  },
  {
    id: "a-compressor1",
    name: "Compressor 1 — Atlas Copco GA-30",
    code: "CP-01",
    location: "Compressor Room",
    criticality: "high",
    qr_hash: "CP01",
    total_running_hours: 6210,
    next_trigger_hours: 6500,
    notes: "Air dryer desiccant swap at 6500 hr.",
    created_at: daysAgo(120),
  },
];

const WORK_ORDERS: WorkOrder[] = [
  {
    id: "wo-1",
    asset_id: "a-feedpump",
    title: "Mechanical seal inspection — 500-hr PM",
    description:
      "Routine 500 running-hour seal inspection. Inspect seal faces, replace if scoring > 0.2mm, repack gland.",
    status: "todo",
    priority: "planned",
    failure_category: "mechanical",
    assigned_to: "u-artisan",
    downtime_mins: 0,
    created_at: hoursAgo(3),
    updated_at: hoursAgo(3),
  },
  {
    id: "wo-2",
    asset_id: "a-stuffer2",
    title: "Hydraulic leak at stuffing horn — breakdown",
    description: "Operator reported oil pooling under stuffer. Likely VFD compartment seal weeped after washdown.",
    status: "todo",
    priority: "emergency",
    failure_category: "washdown_ingress",
    assigned_to: "u-artisan",
    downtime_mins: 45,
    created_at: hoursAgo(1),
    updated_at: hoursAgo(1),
  },
  {
    id: "wo-3",
    asset_id: "a-boiler1",
    title: "Replace combustion air filter — PM",
    description: "Quarterly filter swap. Use Donaldson P181066.",
    status: "in_progress",
    priority: "planned",
    assigned_to: "u-artisan",
    downtime_mins: 0,
    created_at: hoursAgo(8),
    updated_at: hoursAgo(2),
    started_at: hoursAgo(2),
  },
  {
    id: "wo-4",
    asset_id: "a-coldroom3",
    title: "Evaporator coil iced — defrost heater fault",
    description: "Coil iced over weekend. Defrost heater element open-circuit. Replaced element + reset controller.",
    status: "completed",
    priority: "emergency",
    failure_category: "electrical",
    assigned_to: "u-artisan",
    downtime_mins: 180,
    created_at: daysAgo(2),
    updated_at: daysAgo(1),
    started_at: daysAgo(2),
    completed_at: daysAgo(1),
    signed_off_by: "u-artisan",
    signed_off_at: daysAgo(1),
    approved_by: "u-supervisor",
    approved_at: daysAgo(1),
  },
  {
    id: "wo-5",
    asset_id: "a-conveyor4",
    title: "Belt tracking — crown roller adjust",
    description: "Belt drifting 12mm to drive side after wet sanitise.",
    status: "completed",
    priority: "ci",
    failure_category: "mechanical",
    assigned_to: "u-artisan",
    downtime_mins: 25,
    created_at: daysAgo(4),
    updated_at: daysAgo(3),
    started_at: daysAgo(4),
    completed_at: daysAgo(3),
    signed_off_by: "u-artisan",
    signed_off_at: daysAgo(3),
    approved_by: "u-supervisor",
    approved_at: daysAgo(3),
  },
  {
    id: "wo-6",
    asset_id: "a-compressor1",
    title: "Pressure switch nuisance trip — investigate",
    description: "Compressor tripped on high-pressure 3× last shift. Check switch setpoint & unload valve.",
    status: "todo",
    priority: "emergency",
    failure_category: "electrical",
    assigned_to: undefined,
    downtime_mins: 60,
    created_at: hoursAgo(5),
    updated_at: hoursAgo(5),
  },
];

const PHOTOS: WorkOrderPhoto[] = [
  {
    id: "ph-1",
    work_order_id: "wo-4",
    kind: "before",
    data_url: "",
    created_at: daysAgo(2),
  },
];

const ASSET_FILES: AssetFile[] = [
  {
    id: "af-1",
    asset_id: "a-boiler1",
    label: "Electrical Schematic — CB-700",
    file_type: "pdf",
    url: "https://www.cleaver-brooks.com/reference/cb700-schematic.pdf",
    created_at: daysAgo(120),
  },
  {
    id: "af-2",
    asset_id: "a-boiler1",
    label: "Operation & Maintenance Manual",
    file_type: "pdf",
    url: "https://www.cleaver-brooks.com/reference/cb700-manual.pdf",
    created_at: daysAgo(120),
  },
  {
    id: "af-3",
    asset_id: "a-stuffer2",
    label: "Reiser VR200 Wiring Diagram",
    file_type: "pdf",
    url: "https://www.reiser.com/manuals/vr200-wiring.pdf",
    created_at: daysAgo(120),
  },
  {
    id: "af-4",
    asset_id: "a-feedpump",
    label: "Goulds 3196 Parts Breakdown",
    file_type: "pdf",
    url: "https://www.gouldspumps.com/3196-parts.pdf",
    created_at: daysAgo(120),
  },
];

const CIL_ROUTINES: CilRoutine[] = [
  {
    id: "cil-1",
    asset_id: "a-boiler1",
    name: "Daily Boiler CIL",
    cadence: "daily",
    active: true,
    created_at: daysAgo(60),
    checklist: [
      {
        id: "s1",
        prompt: "Check boiler water sight glass pH",
        kind: "numeric",
        unit: "pH",
        min: 10.5,
        max: 11.5,
        guide: "Normal range 10.5–11.5. If outside, notify supervisor.",
      },
      {
        id: "s2",
        prompt: "Inspect burner flame — stable blue?",
        kind: "pass_fail",
        guide: "Blue flame, no flicker or roll-out.",
      },
      {
        id: "s3",
        prompt: "Verify combustion air intake clear",
        kind: "pass_fail",
        guide: "No obstructions within 1m of intake.",
      },
      {
        id: "s4",
        prompt: "Record VFD / running hours",
        kind: "numeric",
        unit: "hours",
        guide: "Read from HMI — Runtime Total.",
      },
    ],
  },
  {
    id: "cil-2",
    asset_id: "a-stuffer2",
    name: "Weekly Stuffer Hydraulic Inspection",
    cadence: "weekly",
    active: true,
    created_at: daysAgo(60),
    checklist: [
      {
        id: "s1",
        prompt: "Inspect hydraulic hoses for weeping",
        kind: "pass_fail",
        guide: "Focus on stuffing horn gland seal.",
      },
      {
        id: "s2",
        prompt: "Check hydraulic oil reservoir level",
        kind: "pass_fail",
        guide: "Between MIN/MAX marks on sight gauge.",
      },
      {
        id: "s3",
        prompt: "Record running hours",
        kind: "numeric",
        unit: "hours",
      },
    ],
  },
  {
    id: "cil-3",
    asset_id: "a-coldroom3",
    name: "Daily Cold Room Defrost Check",
    cadence: "daily",
    active: true,
    created_at: daysAgo(60),
    checklist: [
      {
        id: "s1",
        prompt: "Confirm room temperature −18°C ± 1",
        kind: "numeric",
        unit: "°C",
        min: -19,
        max: -17,
      },
      {
        id: "s2",
        prompt: "Inspect evaporator coil — no ice build-up",
        kind: "pass_fail",
        guide: "Light frost OK, solid ice = call maintenance.",
      },
      {
        id: "s3",
        prompt: "Verify defrost heater continuity",
        kind: "pass_fail",
      },
      {
        id: "s4",
        prompt: "Record running hours",
        kind: "numeric",
        unit: "hours",
      },
    ],
  },
];

const PM_TRIGGERS: PmTrigger[] = [
  {
    id: "pt-1",
    asset_id: "a-boiler1",
    interval_hours: 500,
    last_triggered_hours: 4500,
    next_trigger_hours: 5000,
    routine_template: "Boiler 500-hr inspection — burners, controls, blowdown valve",
    active: true,
  },
  {
    id: "pt-2",
    asset_id: "a-feedpump",
    interval_hours: 500,
    last_triggered_hours: 4500,
    next_trigger_hours: 5000,
    routine_template: "Feed pump 500-hr seal inspection",
    active: true,
  },
  {
    id: "pt-3",
    asset_id: "a-compressor1",
    interval_hours: 1000,
    last_triggered_hours: 5500,
    next_trigger_hours: 6500,
    routine_template: "Compressor desiccant dryer swap + oil sample",
    active: true,
  },
  {
    id: "pt-4",
    asset_id: "a-stuffer2",
    interval_hours: 500,
    last_triggered_hours: 3000,
    next_trigger_hours: 3500,
    routine_template: "Stuffer hydraulic seal service",
    active: true,
  },
  {
    id: "pt-5",
    asset_id: "a-conveyor4",
    interval_hours: 500,
    last_triggered_hours: 2000,
    next_trigger_hours: 2500,
    routine_template: "Conveyor belt tracking + crown roller service",
    active: true,
  },
  {
    id: "pt-6",
    asset_id: "a-coldroom3",
    interval_hours: 1000,
    last_triggered_hours: 8000,
    next_trigger_hours: 9000,
    routine_template: "Cold room evaporator deep clean + heater test",
    active: true,
  },
];

const CIL_RUNS: CilRun[] = [
  {
    id: "crun-1",
    routine_id: "cil-1",
    asset_id: "a-boiler1",
    user_id: "u-operator",
    started_at: daysAgo(1),
    completed_at: daysAgo(1),
    responses: [
      { step_id: "s1", value: "11.0" },
      { step_id: "s2", value: true },
      { step_id: "s3", value: true },
      { step_id: "s4", value: "4790" },
    ],
    runtime_hours_entry: 4790,
  },
];

const DOWNTIME_LOGS: DowntimeLog[] = [
  {
    id: "dl-1",
    asset_id: "a-coldroom3",
    work_order_id: "wo-4",
    failure_category: "electrical",
    minutes: 180,
    logged_at: daysAgo(1),
    note: "Defrost heater element failure.",
  },
  {
    id: "dl-2",
    asset_id: "a-conveyor4",
    work_order_id: "wo-5",
    failure_category: "mechanical",
    minutes: 25,
    logged_at: daysAgo(3),
    note: "Belt tracking drift.",
  },
  {
    id: "dl-3",
    asset_id: "a-stuffer2",
    failure_category: "washdown_ingress",
    minutes: 90,
    logged_at: daysAgo(6),
    note: "Hydraulic seal weeped after washdown.",
  },
  {
    id: "dl-4",
    asset_id: "a-compressor1",
    failure_category: "electrical",
    minutes: 120,
    logged_at: daysAgo(8),
    note: "Pressure switch nuisance trips.",
  },
  {
    id: "dl-5",
    asset_id: "a-stuffer2",
    failure_category: "washdown_ingress",
    minutes: 60,
    logged_at: daysAgo(14),
    note: "VFD compartment moisture.",
  },
  {
    id: "dl-6",
    asset_id: "a-coldroom3",
    failure_category: "operator_error",
    minutes: 40,
    logged_at: daysAgo(20),
    note: "Door left open during loading.",
  },
];

export async function isSeeded(): Promise<boolean> {
  const db = await getDb();
  const count = await db.count("assets");
  return count > 0;
}

export async function seedIfNeeded(force = false): Promise<void> {
  if (force) {
    const flagged = await (await getDb()).get("meta", SEED_FLAG);
    if (!force && flagged) return;
  }
  const already = await isSeeded();
  if (already && !force) return;

  const db = await getDb();
  const tx = db.transaction(
    [
      "users",
      "assets",
      "work_orders",
      "work_order_photos",
      "asset_files",
      "cil_routines",
      "cil_runs",
      "downtime_logs",
      "pm_triggers",
      "meta",
    ],
    "readwrite",
  );

  await Promise.all([
    ...USERS.map((u) => tx.objectStore("users").put(u)),
    ...ASSETS.map((a) => tx.objectStore("assets").put(a)),
    ...WORK_ORDERS.map((w) => tx.objectStore("work_orders").put(w)),
    ...PHOTOS.map((p) => tx.objectStore("work_order_photos").put(p)),
    ...ASSET_FILES.map((f) => tx.objectStore("asset_files").put(f)),
    ...CIL_ROUTINES.map((c) => tx.objectStore("cil_routines").put(c)),
    ...CIL_RUNS.map((r) => tx.objectStore("cil_runs").put(r)),
    ...DOWNTIME_LOGS.map((d) => tx.objectStore("downtime_logs").put(d)),
    ...PM_TRIGGERS.map((p) => tx.objectStore("pm_triggers").put(p)),
  ]);

  await tx.done;
  await setMeta(SEED_FLAG, { at: nowIso() });
}

/** Re-seed from scratch (wipes all data). Demo reset. */
export async function reseed(): Promise<void> {
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
  await seedIfNeeded(true);
}

/** Ensure a fresh seed id prefix matches existing convention. */
export function newId(prefix: string): string {
  return uid(prefix);
}
