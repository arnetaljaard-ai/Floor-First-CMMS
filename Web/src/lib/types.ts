// Domain types for Floor-First CMMS

export type Role = "admin" | "supervisor" | "artisan" | "operator";

export type Criticality = "critical" | "high" | "medium" | "low";

export type WorkOrderStatus = "todo" | "in_progress" | "completed";

export type Priority = "emergency" | "planned" | "ci";

export type FailureCategory =
  | "electrical"
  | "mechanical"
  | "washdown_ingress"
  | "operator_error"
  | "other";

export type Cadence = "daily" | "weekly";

export type ChecklistStepKind = "pass_fail" | "numeric" | "photo";

export interface ChecklistStep {
  id: string;
  prompt: string;
  kind: ChecklistStepKind;
  /** For numeric steps */
  unit?: string;
  min?: number;
  max?: number;
  /** Visual guide text shown under the prompt */
  guide?: string;
}

export interface User {
  id: string;
  full_name: string;
  role: Role;
  /** 4-digit pin stored as plaintext for demo; in production hash via Supabase */
  pin: string;
  avatar_color: string;
  active: boolean;
  created_at: string;
}

export interface Asset {
  id: string;
  name: string;
  code: string;
  location: string;
  criticality: Criticality;
  qr_hash: string;
  total_running_hours: number;
  next_trigger_hours: number;
  notes?: string;
  created_at: string;
}

export interface WorkOrder {
  id: string;
  asset_id: string;
  title: string;
  description?: string;
  status: WorkOrderStatus;
  priority: Priority;
  failure_category?: FailureCategory;
  assigned_to?: string;
  downtime_mins: number;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  signed_off_by?: string;
  signed_off_at?: string;
  approved_by?: string;
  approved_at?: string;
}

export interface WorkOrderPhoto {
  id: string;
  work_order_id: string;
  kind: "before" | "after";
  /** object URL or base64 data URL for local storage */
  data_url: string;
  created_at: string;
}

export interface WorkOrderComment {
  id: string;
  work_order_id: string;
  user_id: string;
  text: string;
  created_at: string;
}

export interface AssetFile {
  id: string;
  asset_id: string;
  label: string;
  file_type: "pdf" | "image" | "link";
  /** URL or data URL */
  url: string;
  created_at: string;
}

export interface CilRoutine {
  id: string;
  asset_id: string;
  name: string;
  cadence: Cadence;
  checklist: ChecklistStep[];
  active: boolean;
  created_at: string;
}

export interface CilRunResponse {
  step_id: string;
  value: string | boolean | null;
}

export interface CilRun {
  id: string;
  routine_id: string;
  asset_id: string;
  user_id: string;
  started_at: string;
  completed_at?: string;
  responses: CilRunResponse[];
  runtime_hours_entry?: number;
  notes?: string;
}

export interface DowntimeLog {
  id: string;
  asset_id: string;
  work_order_id?: string;
  failure_category: FailureCategory;
  minutes: number;
  logged_at: string;
  note?: string;
}

export interface PmTrigger {
  id: string;
  asset_id: string;
  interval_hours: number;
  last_triggered_hours: number;
  next_trigger_hours: number;
  routine_template: string;
  active: boolean;
}

export interface SyncQueueItem {
  id: string;
  table: string;
  op: "insert" | "update" | "delete";
  record_id: string;
  payload: unknown;
  created_at: string;
  synced: 0 | 1;
}

export const FAILURE_CATEGORY_LABELS: Record<FailureCategory, string> = {
  electrical: "VFD / Electrical",
  mechanical: "Mechanical Wear",
  washdown_ingress: "Moisture / Washdown Ingress",
  operator_error: "Operator Error",
  other: "Other",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  emergency: "Emergency Breakdown",
  planned: "Planned PM",
  ci: "Continuous Improvement",
};

export const CRITICALITY_LABELS: Record<Criticality, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  supervisor: "Supervisor",
  artisan: "Artisan",
  operator: "Operator / GA",
};