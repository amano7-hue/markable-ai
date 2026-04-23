import { Skeleton } from '@/components/ui/skeleton'

export default function AttributionLoading() {
  return (
    <div className="max-w-4xl space-y-8">
      <Skeleton className="h-7 w-48" />
      <div className="rounded-lg border border-border p-6 space-y-4">
        <Skeleton className="h-5 w-56" />
        <div className="flex items-end gap-0 h-32">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <Skeleton className="w-full rounded-t-sm" style={{ height: `${(5 - i) * 20}px` }} />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-5 w-48" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-8 rounded-full" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
