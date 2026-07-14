import { ShieldCheck, PackageCheck, Sparkles } from "lucide-react";

export function TrustBadge({
  kind,
  size = "sm",
}: {
  kind: "verified" | "inspected" | "inspection-pending";
  size?: "sm" | "md";
}) {
  const map = {
    verified: {
      icon: ShieldCheck,
      label: "AI Verified",
      cls: "bg-verified/10 text-verified border-verified/30",
    },
    inspected: {
      icon: PackageCheck,
      label: "Doorstep Inspected",
      cls: "bg-success/10 text-success border-success/30",
    },
    "inspection-pending": {
      icon: Sparkles,
      label: "Inspection Pending",
      cls: "bg-warning/15 text-warning-foreground border-warning/40",
    },
  } as const;
  const item = map[kind];
  const Icon = item.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border font-semibold uppercase tracking-wide ${item.cls} ${
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[11px]"
      }`}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {item.label}
    </span>
  );
}
