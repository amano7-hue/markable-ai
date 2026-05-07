import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import NewArticleForm from './new-article-form'

export const metadata: Metadata = { title: '記事を作成 — SEO' }

export default async function NewArticlePage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  // 登録済みアクティブキーワード一覧（選択肢として提供）
  const keywords = await prisma.seoKeyword.findMany({
    where: { tenantId: ctx.tenant.id, isActive: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      text: true,
      snapshots: {
        orderBy: { snapshotDate: 'desc' },
        take: 1,
        select: { position: true },
      },
    },
    take: 100,
  })

  const keywordList = keywords.map((k) => ({
    id: k.id,
    text: k.text,
    position: k.snapshots[0]?.position ?? null,
  }))

  return (
    <div className="max-w-xl px-4 py-5 md:px-6 md:py-6">
      <div className="mb-5">
        <h1 className="text-lg font-semibold">記事を作成</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          キーワードを指定して AI が記事ドラフトを生成します
        </p>
      </div>
      <NewArticleForm keywords={keywordList} />
    </div>
  )
}
