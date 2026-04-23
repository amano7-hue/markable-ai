'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export default function SyncGa4Button() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSync() {
    setLoading(true)
    const res = await fetch('/api/ga4/sync', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (res.ok) {
      toast.success(`${data.synced ?? 0} 日分のデータを同期しました`)
      router.refresh()
    } else {
      toast.error(data.error ?? '同期に失敗しました')
    }
  }

  return (
    <Button size="sm" onClick={handleSync} disabled={loading}>
      {loading ? '同期中...' : 'データを同期'}
    </Button>
  )
}
