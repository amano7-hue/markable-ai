'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export default function SyncAeoButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSync() {
    setLoading(true)
    const res = await fetch('/api/aeo/sync', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (res.ok) {
      toast.success('スナップショット同期をキューに追加しました')
      router.refresh()
    } else {
      toast.error(data.error ?? '同期に失敗しました')
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleSync} disabled={loading}>
      {loading ? '同期中...' : 'Seranking から同期'}
    </Button>
  )
}
