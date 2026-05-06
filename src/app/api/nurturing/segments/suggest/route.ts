import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { GoogleGenAI } from '@google/genai'

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })

export async function POST() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  // リードの分布データを集計
  const [lifecycleDist, icpDist, totalLeads] = await Promise.all([
    prisma.nurtureLead.groupBy({
      by: ['lifecycle'],
      where: { tenantId: ctx.tenant.id },
      _count: true,
    }),
    prisma.nurtureLead.findMany({
      where: { tenantId: ctx.tenant.id },
      select: { icpScore: true },
    }),
    prisma.nurtureLead.count({ where: { tenantId: ctx.tenant.id } }),
  ])

  if (totalLeads === 0) return err('リードがありません', 400)

  const scores = icpDist.map((r) => r.icpScore)
  const avgScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
  const highIcpCount = scores.filter((s) => s >= 70).length
  const midIcpCount = scores.filter((s) => s >= 40 && s < 70).length

  const lifecycleSummary = lifecycleDist
    .map((r) => `${r.lifecycle ?? '不明'}: ${r._count}件`)
    .join(', ')

  const prompt = `あなたはBtoBマーケティングの専門家です。以下のリードデータ分布を分析して、効果的なナーチャリングセグメントを3〜4つ提案してください。

リード数: ${totalLeads}件
ライフサイクル分布: ${lifecycleSummary}
ICP スコア: 平均 ${avgScore} / 高スコア(70+): ${highIcpCount}件 / 中スコア(40-69): ${midIcpCount}件

以下の JSON 形式で回答してください（説明文は不要、JSONのみ）:
[
  {
    "name": "セグメント名",
    "description": "セグメントの説明（1〜2文）",
    "criteria": {
      "lifecycle": ["ライフサイクル値の配列、不要なら省略"],
      "minIcpScore": 最低ICPスコア数値（不要なら省略）
    },
    "reason": "このセグメントを提案する理由（1文）"
  }
]

ライフサイクル値は以下から選択: lead, marketingqualifiedlead, salesqualifiedlead, opportunity, customer`

  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  })

  const raw = result.text ?? '[]'

  // JSON 部分を抽出
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return err('AI の応答を解析できませんでした', 500)

  const suggestions = JSON.parse(jsonMatch[0]) as Array<{
    name: string
    description: string
    criteria: { lifecycle?: string[]; minIcpScore?: number }
    reason: string
  }>

  return ok({ suggestions })
}
