import { ReactNode } from "react";
import { cn } from "@/lib/cn";

const colorClasses = {
  gray: "bg-slate-100 text-slate-700",
  blue: "bg-blue-100 text-blue-700",
  yellow: "bg-yellow-100 text-yellow-800",
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
  orange: "bg-orange-100 text-orange-700",
};

export type BadgeColor = keyof typeof colorClasses;

export function Badge({ color = "gray", children }: { color?: BadgeColor; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", colorClasses[color])}>
      {children}
    </span>
  );
}
