'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export default function SyncLeadsButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSync() {
    setLoading(true)
    const res = await fetch('/api/nurturing/sync', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (res.ok) {
      toast.success(`${data.synced ?? 0} 件のリードを同期しました`)
      router.refresh()
    } else {
      toast.error(data.error ?? '同期に失敗しました')
    }
  }

  return (
    <Button onClick={handleSync} disabled={loading} size="sm">
      {loading ? '同期中...' : 'HubSpot から同期'}
    </Button>
  )
}
