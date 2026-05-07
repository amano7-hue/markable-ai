import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { getTemplates } from '@/modules/llmo'
import TemplateSelector from '@/app/dashboard/llmo/prompts/from-templates/template-selector'

export const metadata: Metadata = { title: 'テンプレートから追加 — LLMO' }

type Props = { params: Promise<{ projectId: string }> }

export default async function FromTemplatesPage({ params }: Props) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) redirect('/onboarding')

  const base = `/dashboard/p/${projectId}/llmo`
  const templates = getTemplates()

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`${base}/prompts`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </Link>
        <h1 className="text-2xl font-semibold">テンプレートから一括追加</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        追跡したいプロンプトをまとめて選択して追加できます。重複するテキストは自動でスキップされます。
      </p>
      <TemplateSelector templates={templates} projectId={projectId} backHref={`${base}/prompts`} />
    </div>
  )
}
