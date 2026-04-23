'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard] error boundary caught:', error)
  }, [error])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-sm font-medium text-destructive">エラーが発生しました</p>
          <p className="text-sm text-muted-foreground">
            {error.message || 'ページの読み込みに失敗しました。'}
          </p>
          <Button variant="outline" onClick={reset}>
            再読み込み
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
