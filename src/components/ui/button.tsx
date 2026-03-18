import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-all duration-150",
        variant === "default" &&
          "bg-[#426F59] text-white hover:bg-[#355849] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
        variant === "outline" &&
          "border border-[#426F59] text-[#426F59] bg-white hover:bg-[#F0F7F4]",
        variant === "ghost" && "text-[#426F59] hover:bg-[#F0F7F4]",
        variant === "destructive" &&
          "bg-red-600 text-white hover:bg-red-700 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
        size === "default" && "h-10 px-4 py-2 text-sm",
        size === "sm" && "h-8 px-3 text-xs",
        size === "lg" && "h-12 px-6 text-base",
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
