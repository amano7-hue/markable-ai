'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'

export default function GenerateAllButton({
  opportunities,
}: {
  opportunities: { keywordId: string; keyword: string }[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleGenerateAll() {
    setLoading(true)
    let success = 0
    let failed = 0

    await Promise.all(
      opportunities.map(async ({ keywordId, keyword }) => {
        const res = await fetch('/api/seo/articles/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywordId, title: `${keyword}について` }),
        })
        if (res.ok) success++
        else failed++
      }),
    )

    setLoading(false)
    if (failed === 0) {
      toast.success(`${success} 件の記事ドラフトを承認キューに追加しました`)
    } else {
      toast.warning(`${success} 件成功、${failed} 件失敗しました`)
    }
    router.refresh()
  }

  return (
    <button
      onClick={handleGenerateAll}
      disabled={loading || opportunities.length === 0}
      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
    >
      <Sparkles className="h-3 w-3" />
      {loading ? '生成中...' : `全件生成 (${opportunities.length}件)`}
    </button>
  )
}
