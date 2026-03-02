import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/shared/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-secondary-light">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "block w-full rounded-lg border border-border-light bg-surface-light py-2 text-sm text-text-primary-light placeholder-text-secondary-light",
            "focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary",
            "dark:border-border-dark dark:bg-surface-dark dark:text-text-primary-dark dark:focus:border-primary",
            icon ? "pl-10 pr-3" : "px-3",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = "Input";
