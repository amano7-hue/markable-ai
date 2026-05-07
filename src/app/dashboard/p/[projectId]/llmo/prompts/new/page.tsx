import type { Metadata } from 'next'
import Link from 'next/link'
import PromptForm from '@/app/dashboard/llmo/prompts/new/prompt-form'

export const metadata: Metadata = { title: 'プロンプト追加 — LLMO' }

type Props = { params: Promise<{ projectId: string }> }

export default async function NewPromptPage({ params }: Props) {
  const { projectId } = await params
  const base = `/dashboard/p/${projectId}/llmo`

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`${base}/prompts`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </Link>
        <h1 className="text-2xl font-semibold">プロンプトを追加</h1>
      </div>
      <PromptForm projectId={projectId} backHref={`${base}/prompts`} />
    </div>
  )
}
