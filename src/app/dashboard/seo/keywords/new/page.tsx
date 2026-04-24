import type { Metadata } from 'next'
import Link from 'next/link'
import KeywordForm from './keyword-form'

export const metadata: Metadata = { title: 'キーワード追加 — SEO' }

export default function NewKeywordPage() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/seo/keywords"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </Link>
        <h1 className="text-2xl font-semibold">キーワードを追加</h1>
      </div>
      <KeywordForm />
    </div>
  )
}
