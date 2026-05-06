'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export default function SyncLlmoButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSync() {
    setLoading(true)
    toast.info('AI エンジンへの問い合わせを開始しました（数分かかる場合があります）')

    const res = await fetch('/api/llmo/sync', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (res.ok) {
      toast.success('引用チェックが完了しました')
      router.refresh()
    } else {
      toast.error(data.error ?? '同期に失敗しました')
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleSync} disabled={loading}>
      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'チェック中...' : 'LLM 引用チェック'}
    </Button>
  )
}
