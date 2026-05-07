'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'

export default function PromptSuggestButton({ promptId, projectId }: { promptId: string; projectId?: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    setLoading(true)
    const url = projectId
      ? `/api/p/${projectId}/llmo/prompts/${promptId}/suggest`
      : `/api/llmo/prompts/${promptId}/suggest`
    const res = await fetch(url, { method: 'POST' })
    setLoading(false)
    if (res.ok) {
      toast.success('改善提案を承認キューに追加しました')
    } else {
      const json = await res.json().catch(() => ({})) as { error?: string }
      toast.error(json.error ?? 'エラーが発生しました')
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
    >
      <Sparkles className="h-3 w-3" />
      {loading ? '生成中...' : '提案を生成'}
    </button>
  )
}
