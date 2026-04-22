'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function SyncLeadsButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSync() {
    setLoading(true)
    setMessage(null)

    const res = await fetch('/api/nurturing/sync', { method: 'POST' })
    const data = await res.json().catch(() => ({}))

    setLoading(false)

    if (res.ok) {
      setMessage(`${data.data?.synced ?? 0} 件同期しました`)
      router.refresh()
    } else {
      setMessage('同期に失敗しました')
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message && <span className="text-sm text-muted-foreground">{message}</span>}
      <Button onClick={handleSync} disabled={loading} size="sm">
        {loading ? '同期中...' : 'HubSpot から同期'}
      </Button>
    </div>
  )
}
