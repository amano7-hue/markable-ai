import { Skeleton } from '@/components/ui/skeleton'

/**
 * Generic loading skeleton for module pages with a sidebar layout.
 * Used by loading.tsx files inside /dashboard/aeo, /seo, /nurturing, etc.
 */
export function ModulePageLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-48" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-64" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Stat card grid loading skeleton.
 */
export function StatsLoading({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-48" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-4 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
