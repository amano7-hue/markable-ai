'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function AnalyzingBanner() {
  const router = useRouter()
  const timesRefreshed = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      timesRefreshed.current += 1
      router.refresh()
      if (timesRefreshed.current >= 12) clearInterval(interval) // 最大3分 (12 × 15s)
    }, 15_000)
    return () => clearInterval(interval)
  }, [router])

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-blue-300/60 bg-blue-50/60 px-4 py-3 text-sm dark:border-blue-700/40 dark:bg-blue-950/30">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
      <div>
        <p className="font-medium text-blue-700 dark:text-blue-300">記事構成を分析中です</p>
        <p className="text-xs text-muted-foreground">SERP解析 → 読者ニーズ分析 → 競合調査 → 見出し設計。完了次第ページが自動更新されます（20〜30秒）</p>
      </div>
    </div>
  )
}
