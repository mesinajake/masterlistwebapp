import { cn } from "@/shared/utils/cn";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-gray-200 dark:bg-gray-700",
        className
      )}
    />
  );
}

/** Table-shaped skeleton for loading state */
export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-6">
      {/* Header skeleton */}
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={`r-${rIdx}`} className="flex gap-4">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <Skeleton key={`r-${rIdx}-c-${cIdx}`} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
