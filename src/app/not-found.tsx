import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <p className="text-5xl font-bold text-muted-foreground">404</p>
        <p className="text-lg font-medium">ページが見つかりません</p>
        <p className="text-sm text-muted-foreground">
          このURLは存在しないか、移動した可能性があります。
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-md border border-input px-4 py-2 text-sm hover:bg-accent transition-colors"
        >
          ダッシュボードへ戻る
        </Link>
      </div>
    </main>
  )
}
