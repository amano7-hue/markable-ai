import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { generateIcpRules, saveIcpConfig } from '@/modules/nurturing/icp-config-service'
import type { IcpAnswers } from '@/modules/nurturing/icp-config-service'
import { z } from 'zod'

const Schema = z.object({
  industries: z.string().min(1),
  companySizes: z.string().min(1),
  annualRevenues: z.string().min(1),
  jobTitles: z.string().min(1),
  otherCriteria: z.string().default(''),
})

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  try {
    const answers: IcpAnswers = parsed.data
    const rules = await generateIcpRules(answers)
    await saveIcpConfig(ctx.tenant.id, answers, rules)
    return ok({ rules })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[icp-config/setup] failed:', msg)
    return err(`ICPルールの生成に失敗しました: ${msg}`, 500)
  }
}
