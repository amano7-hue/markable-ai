'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export default function SuggestButton({ promptId }: { promptId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const res = await fetch(`/api/aeo/prompts/${promptId}/suggest`, { method: 'POST' })
    setLoading(false)
    if (res.ok) {
      toast.success('改善提案を承認キューに追加しました')
    } else {
      const json = await res.json().catch(() => ({}))
      toast.error(json.error ?? 'エラーが発生しました')
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading} variant="secondary">
      {loading ? '生成中...' : '改善提案を生成'}
    </Button>
  )
}
