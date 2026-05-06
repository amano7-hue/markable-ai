import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import EmptyState from '@/components/empty-state'
import { Link2, ArrowRight, Info } from 'lucide-react'

export const metadata: Metadata = { title: '内部リンク提案 — SEO' }

const INTENT_LABELS: Record<string, string> = {
  informational: '情報収集',
  commercial: '比較検討',
  navigational: 'ナビゲーション',
}

// インテントの「流れ」スコア。情報収集 → 比較検討 のリンクが最も価値が高い
const INTENT_FLOW_SCORE: Record<string, number> = {
  'informational→commercial': 3,
  'informational→navigational': 2,
  'commercial→navigational': 2,
  'informational→informational': 1,
  'commercial→commercial': 1,
  'navigational→navigational': 0,
}

type Article = {
  id: string
  title: string
  brief: string
  keywordText: string | null
  keywordIntent: string | null
}

/** キーワードの単語トークン（2文字以上の語）を抽出 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[\s\u3000、。・「」【】()（）\-_/]+/)
      .filter((t) => t.length >= 2),
  )
}

/** 2記事間の関連スコア (0-100) */
function relScore(a: Article, b: Article): number {
  const tokA = tokenize(`${a.title} ${a.brief} ${a.keywordText ?? ''}`)
  const tokB = tokenize(`${b.title} ${b.brief} ${b.keywordText ?? ''}`)
  const intersection = [...tokA].filter((t) => tokB.has(t)).length
  if (intersection === 0) return 0
  const union = new Set([...tokA, ...tokB]).size
  const jaccard = intersection / union
  // インテントフローボーナス
  const flowKey = `${a.keywordIntent ?? ''}→${b.keywordIntent ?? ''}`
  const flowBonus = INTENT_FLOW_SCORE[flowKey] ?? 0
  return Math.round(jaccard * 80 + flowBonus * 5)
}

export default async function InternalLinksPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const rawArticles = await prisma.seoArticle.findMany({
    where: { tenantId: ctx.tenant.id },
    include: {
      keyword: { select: { text: true, intent: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const articles: Article[] = rawArticles.map((a) => ({
    id: a.id,
    title: a.title,
    brief: a.brief,
    keywordText: a.keyword?.text ?? null,
    keywordIntent: a.keyword?.intent ?? null,
  }))

  type Suggestion = {
    from: Article
    to: Article
    score: number
    reason: string
  }

  const suggestions: Suggestion[] = []

  // 全ペアを評価（O(n²)だがn<200程度なので問題なし）
  for (let i = 0; i < articles.length; i++) {
    for (let j = 0; j < articles.length; j++) {
      if (i === j) continue
      const score = relScore(articles[i], articles[j])
      if (score < 15) continue // 閾値以下は除外

      const fromIntent = articles[i].keywordIntent
      const toIntent = articles[j].keywordIntent
      const flowKey = `${fromIntent ?? ''}→${toIntent ?? ''}`
      const flowScore = INTENT_FLOW_SCORE[flowKey] ?? 0

      let reason = 'キーワードの重複が検出されました'
      if (flowKey === 'informational→commercial') {
        reason = '情報収集ページから比較検討ページへの誘導（コンバージョン向上）'
      } else if (flowKey === 'informational→navigational') {
        reason = '情報収集ページからブランドページへの誘導'
      } else if (flowKey === 'commercial→navigational') {
        reason = '比較検討ページからお問い合わせ・製品ページへの誘導'
      } else if (flowScore === 0 && score >= 30) {
        reason = '関連トピックの相互参照（読者の滞在時間向上）'
      }

      suggestions.push({ from: articles[i], to: articles[j], score, reason })
    }
  }

  // スコア降順、重複除去（from+to のペアを1方向に限定）
  const seen = new Set<string>()
  const filtered = suggestions
    .sort((a, b) => b.score - a.score)
    .filter((s) => {
      const key = [s.from.id, s.to.id].sort().join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 30)

  const noArticles = articles.length < 2

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">内部リンク提案</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            記事間のキーワード重複とインテントフローを解析し、内部リンクを提案します
          </p>
        </div>
        {filtered.length > 0 && (
          <Badge variant="outline" className="text-sm">
            {filtered.length} 件の提案
          </Badge>
        )}
      </div>

      {/* インテントフロー説明 */}
      <div className="mb-6 flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong className="text-foreground">内部リンクの優先度</strong>：
          「情報収集 → 比較検討」のリンクはコンバージョン向上に最も効果的です。
          スコアが高いほど関連度・SEO効果が高い組み合わせです。
        </p>
      </div>

      {noArticles ? (
        <EmptyState
          icon={Link2}
          title="記事が2件以上必要です"
          description="SEO記事ドラフトを生成・承認すると内部リンク提案が表示されます。"
          action={
            <Link
              href="/dashboard/seo/keywords"
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              キーワードを管理
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="提案できるリンクがありません"
          description="記事間のキーワード重複が少ないため提案を生成できません。関連するキーワードで記事を増やしてください。"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((s, idx) => {
            const flowKey = `${s.from.keywordIntent ?? ''}→${s.to.keywordIntent ?? ''}`
            const isPriorityFlow = INTENT_FLOW_SCORE[flowKey] >= 2
            return (
              <Card
                key={idx}
                className={isPriorityFlow ? 'border-primary/30 bg-primary/5' : ''}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {/* FROM */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">リンク元</p>
                      <p className="text-sm font-medium line-clamp-1">{s.from.title}</p>
                      {s.from.keywordIntent && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {INTENT_LABELS[s.from.keywordIntent] ?? s.from.keywordIntent}
                        </Badge>
                      )}
                    </div>

                    {/* 矢印 */}
                    <div className="flex items-center justify-center shrink-0">
                      <ArrowRight
                        className={`h-5 w-5 ${isPriorityFlow ? 'text-primary' : 'text-muted-foreground'}`}
                      />
                    </div>

                    {/* TO */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">リンク先</p>
                      <p className="text-sm font-medium line-clamp-1">{s.to.title}</p>
                      {s.to.keywordIntent && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {INTENT_LABELS[s.to.keywordIntent] ?? s.to.keywordIntent}
                        </Badge>
                      )}
                    </div>

                    {/* スコア */}
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-muted-foreground">関連スコア</p>
                      <p
                        className={`text-lg font-bold tabular-nums ${
                          s.score >= 40
                            ? 'text-primary'
                            : s.score >= 25
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {s.score}
                      </p>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground border-t border-border pt-2">
                    {s.reason}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
