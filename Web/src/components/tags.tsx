import { PRIORITY_LABELS, type Criticality, type FailureCategory, type Priority } from "@/lib/types";

const PRIORITY_STYLES: Record<Priority, string> = {
  emergency: "bg-destructive/15 text-destructive ring-destructive/40",
  planned: "bg-sky-500/15 text-sky-400 ring-sky-500/40",
  ci: "bg-violet-500/15 text-violet-300 ring-violet-500/40",
};

export function PriorityTag({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${PRIORITY_STYLES[priority]}`}
    >
      {PRIORITY_LABELS[priority].split(" ")[0]}
    </span>
  );
}

const CRITICALITY_STYLES: Record<Criticality, string> = {
  critical: "bg-destructive/15 text-destructive",
  high: "bg-amber-500/15 text-amber-400",
  medium: "bg-sky-500/15 text-sky-400",
  low: "bg-muted text-muted-foreground",
};

export function CriticalityTag({ criticality }: { criticality: Criticality }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${CRITICALITY_STYLES[criticality]}`}
    >
      {criticality}
    </span>
  );
}

const FAILURE_STYLES: Record<FailureCategory, string> = {
  electrical: "bg-amber-500/12 text-amber-400",
  mechanical: "bg-sky-500/12 text-sky-400",
  washdown_ingress: "bg-cyan-500/12 text-cyan-300",
  operator_error: "bg-pink-500/12 text-pink-300",
  other: "bg-muted text-muted-foreground",
};

export function FailureTag({ category }: { category: FailureCategory }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${FAILURE_STYLES[category]}`}>
      {category.replace(/_/g, " ")}
    </span>
  );
}

export function Avatar({
  name,
  color,
  size = 28,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <div
      className="grid place-items-center rounded-full font-bold text-black ring-2 ring-white/15"
      style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.36 }}
      title={name}
    >
      {initials}
    </div>
  );
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
