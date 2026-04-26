'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'

export default function GapSuggestAllButton({
  promptIds,
}: {
  promptIds: string[]
}) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const unique = [...new Set(promptIds)]
    let success = 0
    let failed = 0

    await Promise.all(
      unique.map(async (promptId) => {
        const res = await fetch(`/api/aeo/prompts/${promptId}/suggest`, { method: 'POST' })
        if (res.ok) success++
        else failed++
      }),
    )

    setLoading(false)
    if (failed === 0) {
      toast.success(`${success} 件の改善提案を承認キューに追加しました`)
    } else {
      toast.warning(`${success} 件成功、${failed} 件失敗しました`)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || promptIds.length === 0}
      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
    >
      <Sparkles className="h-3 w-3" />
      {loading ? '生成中...' : `全件提案生成 (${[...new Set(promptIds)].length}件)`}
    </button>
  )
}
