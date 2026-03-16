import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {}

export const Badge = ({ className, ...props }: BadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary",
      className,
    )}
    {...props}
  />
);

