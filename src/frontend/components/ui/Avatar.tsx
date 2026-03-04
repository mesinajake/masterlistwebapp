import { cn } from "@/shared/utils/cn";
import { useState } from "react";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  showOnline?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
};

export function Avatar({
  src,
  name,
  size = "md",
  showOnline = false,
  className,
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "overflow-hidden rounded-full border border-border-light bg-surface-light ring-2 ring-transparent hover:ring-primary/20 transition-all",
          sizeMap[size]
        )}
      >
        {src && !imgError ? (
          <img
            src={src}
            alt={name}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary text-xs font-medium">
            {initials}
          </div>
        )}
      </div>
      {showOnline && (
        <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-bg-dark" />
      )}
    </div>
  );
}
