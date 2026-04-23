'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function SyncGa4Button() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSync() {
    setLoading(true)
    setMessage(null)
    const res = await fetch('/api/ga4/sync', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (res.ok) {
      setMessage(`${data.data?.synced ?? 0} 日分同期しました`)
      router.refresh()
    } else {
      setMessage('同期に失敗しました')
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message && <span className="text-sm text-muted-foreground">{message}</span>}
      <Button size="sm" onClick={handleSync} disabled={loading}>
        {loading ? '同期中...' : 'データを同期'}
      </Button>
    </div>
  )
}
