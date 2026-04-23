'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export default function SyncKeywordsButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSync() {
    setLoading(true)
    const res = await fetch('/api/seo/sync', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (res.ok) {
      toast.success(`${data.data?.synced ?? 0} 件のキーワードを同期しました`)
      router.refresh()
    } else {
      toast.error(data.error ?? '同期に失敗しました')
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleSync} disabled={loading}>
      {loading ? '同期中...' : 'GSC から同期'}
    </Button>
  )
}
