'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function GeneratingBanner() {
  const router = useRouter()
  const timesRefreshed = useRef(0)

  useEffect(() => {
    // 15秒ごとに最大8回（=2分間）自動リフレッシュ
    const interval = setInterval(() => {
      timesRefreshed.current += 1
      router.refresh()
      if (timesRefreshed.current >= 8) {
        clearInterval(interval)
      }
    }, 15_000)
    return () => clearInterval(interval)
  }, [router])

  return (
    <div className="mb-5 flex items-center gap-3 rounded-lg border border-blue-300/60 bg-blue-50/60 px-4 py-3 dark:border-blue-700/40 dark:bg-blue-950/30">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
      <div>
        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">記事を生成中です</p>
        <p className="text-xs text-muted-foreground">
          1〜2分かかります。このページは自動的に更新されます。
        </p>
      </div>
    </div>
  )
}
