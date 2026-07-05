interface SkeletonProps {
  className?: string;
}

// Unified loading placeholder per CLAUDE.md T1.6. Pass sizing/shape via
// className (e.g. "h-4 w-32 rounded", "aspect-[2/3] rounded-xl").
export function Skeleton({ className = "h-4 w-full rounded" }: SkeletonProps) {
  return <div className={`animate-pulse bg-slate-100 ${className}`} />;
}
