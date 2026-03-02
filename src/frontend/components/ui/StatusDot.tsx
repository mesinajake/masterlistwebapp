import { cn } from "@/shared/utils/cn";

type StatusColor = "green" | "amber" | "red" | "gray" | "blue";

const colorMap: Record<StatusColor, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  gray: "bg-gray-400",
  blue: "bg-blue-500",
};

interface StatusDotProps {
  color?: StatusColor;
  label?: string;
  className?: string;
}

export function StatusDot({
  color = "green",
  label,
  className,
}: StatusDotProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("h-1.5 w-1.5 rounded-full", colorMap[color])} />
      {label && (
        <span className="text-text-primary-light dark:text-text-primary-dark">
          {label}
        </span>
      )}
    </div>
  );
}
