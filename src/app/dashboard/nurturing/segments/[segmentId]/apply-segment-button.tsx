'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export default function ApplySegmentButton({ segmentId }: { segmentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleApply() {
    setLoading(true)
    const res = await fetch(`/api/nurturing/segments/${segmentId}/apply`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (res.ok) {
      toast.success(`${data.data?.applied ?? 0} 件のリードを再適用しました`)
      router.refresh()
    } else {
      toast.error(data.error ?? '再適用に失敗しました')
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleApply} disabled={loading}>
      {loading ? '適用中...' : '条件を再適用'}
    </Button>
  )
}
