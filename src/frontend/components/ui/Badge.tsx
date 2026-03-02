import { cn } from "@/shared/utils/cn";

// ─── Badge Variants ───────────────────────────────────

type BadgeVariant =
  | "blue"
  | "purple"
  | "indigo"
  | "pink"
  | "gray"
  | "orange"
  | "red"
  | "teal"
  | "green"
  | "yellow";

const variantStyles: Record<BadgeVariant, string> = {
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  purple:
    "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  indigo:
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  pink: "bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  orange:
    "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  red: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  teal: "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  green:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  yellow:
    "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
};

// ─── Component ────────────────────────────────────────

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({
  children,
  variant = "blue",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
