import type { Metadata } from 'next'
import Link from 'next/link'
import PromptForm from './prompt-form'

export const metadata: Metadata = { title: 'プロンプト追加 — AEO' }

export default function NewPromptPage() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/aeo/prompts"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </Link>
        <h1 className="text-2xl font-semibold">プロンプトを追加</h1>
      </div>
      <PromptForm />
    </div>
  )
}
