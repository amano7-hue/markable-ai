import { GoogleGenAI } from '@google/genai'
import { prisma } from '@/lib/db/client'

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })

export interface IcpAnswers {
  industries: string        // 対象業界（例: SaaS、製造業）
  companySizes: string      // 従業員規模（例: 50〜500人）
  annualRevenues: string    // 売上高（例: 1億〜10億円）
  jobTitles: string         // 主な購買意思決定者（例: CTO、マーケティング部長）
  otherCriteria: string     // その他重要な条件
}

export type IcpRule =
  | { type: 'jobTitle'; pattern: string; score: number; description: string }
  | { type: 'employeeCount'; min?: number; max?: number; score: number; description: string }
  | { type: 'annualRevenue'; min?: number; max?: number; score: number; description: string }

export interface IcpRules {
  rules: IcpRule[]
  maxScore: number
  summary: string
}

export async function generateIcpRules(answers: IcpAnswers): Promise<IcpRules> {
  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `あなたはBtoBマーケティングのICP（Ideal Customer Profile）スコアリングの専門家です。
以下のアンケート回答をもとに、リードのICPスコアを計算するためのルールをJSON形式で生成してください。

【ユーザーのターゲット設定】
- 対象業界: ${answers.industries}
- 対象企業規模（従業員数）: ${answers.companySizes}
- 対象企業の売上高: ${answers.annualRevenues}
- 主な意思決定者の役職: ${answers.jobTitles}
- その他の重要条件: ${answers.otherCriteria || 'なし'}

【出力形式】
以下のJSON形式のみで回答してください（説明文不要）:
{
  "rules": [
    {
      "type": "jobTitle",
      "pattern": "役職名のキーワード（正規表現、複数はOR結合）",
      "score": 点数（整数）,
      "description": "このルールの説明"
    },
    {
      "type": "employeeCount",
      "min": 最小従業員数（省略可）,
      "max": 最大従業員数（省略可）,
      "score": 点数（整数）,
      "description": "このルールの説明"
    },
    {
      "type": "annualRevenue",
      "min": 最小売上高（円・省略可）,
      "max": 最大売上高（円・省略可）,
      "score": 点数（整数）,
      "description": "このルールの説明"
    }
  ],
  "maxScore": 100,
  "summary": "このスコアリングロジックの概要（1〜2文）"
}

【ルール設計の指針】
- 全ルールの合計点数が100点を超えないよう設計する
- 役職: 3〜5ルール（C級・VP・部長など階層別に点数差をつける）
- 従業員数: 1〜2ルール（ユーザー指定の規模に一致する範囲に高得点）
- 売上高: 1〜2ルール（ユーザー指定の売上高に一致する範囲に高得点）
- jobTitleのpatternは正規表現（例: "cto|cio|vp of engineering"）
- employeeCount/annualRevenueはmin/maxの両方またはどちらかを指定（単位: 人/円）
- lifecycleステージはスコアリングに使用しないこと
`,
  })

  const text = result.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI がルールを生成できませんでした')

  return JSON.parse(jsonMatch[0]) as IcpRules
}

export async function saveIcpConfig(tenantId: string, answers: IcpAnswers, rules: IcpRules) {
  return prisma.icpConfig.upsert({
    where: { tenantId },
    create: { tenantId, answers, rules },
    update: { answers, rules },
  })
}

export async function getIcpConfig(tenantId: string) {
  return prisma.icpConfig.findUnique({ where: { tenantId } })
}

export function calcIcpScoreFromRules(
  rules: IcpRules,
  jobTitle?: string | null,
  _lifecycle?: string | null,
  numberOfEmployees?: number | null,
  annualRevenue?: number | null,
): number {
  let score = 0
  const title = (jobTitle ?? '').toLowerCase()

  for (const rule of rules.rules) {
    if (rule.type === 'jobTitle') {
      try {
        if (new RegExp(rule.pattern, 'i').test(title)) score += rule.score
      } catch {
        // 無効な正規表現はスキップ
      }
    } else if (rule.type === 'employeeCount' && numberOfEmployees != null) {
      const min = rule.min ?? 0
      const max = rule.max ?? Infinity
      if (numberOfEmployees >= min && numberOfEmployees <= max) score += rule.score
    } else if (rule.type === 'annualRevenue' && annualRevenue != null) {
      const min = rule.min ?? 0
      const max = rule.max ?? Infinity
      if (annualRevenue >= min && annualRevenue <= max) score += rule.score
    }
  }

  return Math.min(score, rules.maxScore ?? 100)
}
