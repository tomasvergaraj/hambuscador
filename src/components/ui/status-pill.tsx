import { cn } from "@/lib/utils";
import type { PlaceStatus } from "@/lib/constants";
import { PLACE_STATUSES } from "@/lib/constants";

const colorClasses: Record<PlaceStatus, string> = {
  open: "bg-lechuga text-white",
  "closing-soon": "bg-tomate text-white",
  closed: "bg-tinta-suave text-white",
};

export type StatusPillProps = {
  status: PlaceStatus;
  className?: string;
};

export function StatusPill({ status, className }: StatusPillProps) {
  const { label } = PLACE_STATUSES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium",
        colorClasses[status],
        className,
      )}
    >
      {label}
    </span>
  );
}
