import { StatsLoading } from '@/components/module-loading'
import { Skeleton } from '@/components/ui/skeleton'

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <StatsLoading count={4} />
      <div className="rounded-lg border border-border p-4 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}
