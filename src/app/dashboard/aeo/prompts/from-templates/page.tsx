import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'

export const metadata: Metadata = { title: 'テンプレートから追加 — AEO' }
import { getTemplates } from '@/modules/aeo'
import TemplateSelector from './template-selector'

export default async function FromTemplatesPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const templates = getTemplates()

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/aeo/prompts"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </Link>
        <h1 className="text-2xl font-semibold">テンプレートから一括追加</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        追跡したいプロンプトをまとめて選択して追加できます。重複するテキストは自動でスキップされます。
      </p>
      <TemplateSelector templates={templates} />
    </div>
  )
}
