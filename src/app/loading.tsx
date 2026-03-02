import { Skeleton } from "@/frontend/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
      {/* Header skeleton */}
      <div className="h-16 border-b border-border-light dark:border-border-dark bg-white dark:bg-surface-dark">
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between h-full">
          <Skeleton className="w-32 h-8" />
          <Skeleton className="w-64 h-9 rounded-lg" />
          <div className="flex gap-3">
            <Skeleton className="w-24 h-9 rounded-lg" />
            <Skeleton className="w-9 h-9 rounded-full" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <Skeleton className="w-48 h-8 mb-2" />
        <Skeleton className="w-32 h-4 mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="w-full h-12 rounded-lg" />
          ))}
        </div>
      </main>
    </div>
  );
}
