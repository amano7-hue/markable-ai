import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { getIcpConfig } from '@/modules/nurturing/icp-config-service'
import { createSegment } from '@/modules/nurturing'
import { prisma } from '@/lib/db/client'
import { GoogleGenAI } from '@google/genai'
import type { IcpAnswers, IcpRules } from '@/modules/nurturing/icp-config-service'

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json().catch(() => ({})) as { projectId?: string }
  const { projectId } = body

  const icpConfig = await getIcpConfig(ctx.tenant.id)
  if (!icpConfig) return err('ICP 設定がありません。先に ICP スコアを設定してください。', 400)

  const answers = icpConfig.answers as unknown as IcpAnswers
  const rules = icpConfig.rules as unknown as IcpRules
  const maxScore = rules.maxScore ?? 100

  // リードのスコア分布を取得
  const scoreDist = await prisma.nurtureLead.findMany({
    where: { tenantId: ctx.tenant.id, ...(projectId ? { projectId } : {}) },
    select: { icpScore: true },
  })
  const totalLeads = scoreDist.length
  const highCount = scoreDist.filter((l) => l.icpScore >= Math.round(maxScore * 0.7)).length
  const midCount = scoreDist.filter((l) => l.icpScore >= Math.round(maxScore * 0.4) && l.icpScore < Math.round(maxScore * 0.7)).length

  const prompt = `あなたはBtoBマーケティングの専門家です。
以下のICP（理想顧客プロファイル）設定とリードスコア分布をもとに、ナーチャリング用のセグメントを3〜4つ自動生成してください。

【ICP設定】
- 対象業界: ${answers.industries}
- 対象企業規模: ${answers.companySizes}
- 対象売上高: ${answers.annualRevenues}
- 意思決定者の役職: ${answers.jobTitles}
- その他条件: ${answers.otherCriteria || 'なし'}
- ICPスコア最大値: ${maxScore}点

【リード分布】
- 総リード数: ${totalLeads}件
- 高スコア（${Math.round(maxScore * 0.7)}点以上）: ${highCount}件
- 中スコア（${Math.round(maxScore * 0.4)}〜${Math.round(maxScore * 0.7) - 1}点）: ${midCount}件

以下のJSON形式のみで回答してください（説明文不要）:
[
  {
    "name": "セグメント名（例: 最優先ターゲット・ウォームリード・育成対象 など）",
    "description": "このセグメントの説明と想定ナーチャリング戦略（1〜2文）",
    "minIcpScore": ICPスコアの下限値（整数）,
    "reason": "このセグメントを設定する理由（1文）"
  }
]

【設計指針】
- ICPスコアの閾値を使ってセグメントを切る（minIcpScore のみ使用、lifecycle は含めない）
- 高スコア層・中スコア層・低スコア層の3〜4セグメントに分類
- 各セグメントに適した具体的なナーチャリング戦略を description に含める
- ICP設定の業界・役職の特性を反映した名前にする`

  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  })

  const raw = result.text ?? '[]'
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return err('AI の応答を解析できませんでした', 500)

  type AiSegment = { name: string; description: string; minIcpScore: number; reason: string }
  const suggestions = JSON.parse(jsonMatch[0]) as AiSegment[]

  // 既存のセグメントと名前が重複しないか確認
  const existingNames = await prisma.nurtureSegment.findMany({
    where: { tenantId: ctx.tenant.id, ...(projectId ? { projectId } : {}) },
    select: { name: true },
  }).then((rows) => new Set(rows.map((r) => r.name)))

  const created: string[] = []
  const skipped: string[] = []

  for (const s of suggestions) {
    if (existingNames.has(s.name)) {
      skipped.push(s.name)
      continue
    }
    await createSegment(ctx.tenant.id, {
      name: s.name,
      description: `${s.description}（理由: ${s.reason}）`,
      criteria: { minIcpScore: s.minIcpScore },
      projectId,
    })
    created.push(s.name)
  }

  return ok({ created, skipped })
}
