'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global] unhandled error:', error)
  }, [error])

  return (
    <html lang="ja">
      <body className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium">予期しないエラーが発生しました</p>
          <p className="text-sm text-muted-foreground">
            {error.digest ? `Error ID: ${error.digest}` : 'しばらく経ってから再度お試しください。'}
          </p>
          <button
            onClick={reset}
            className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent transition-colors"
          >
            再読み込み
          </button>
        </div>
      </body>
    </html>
  )
}
