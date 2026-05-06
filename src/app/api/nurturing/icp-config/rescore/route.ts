import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { getIcpConfig, calcIcpScoreFromRules } from '@/modules/nurturing/icp-config-service'
import type { IcpRules } from '@/modules/nurturing/icp-config-service'
import { calcIcpScore } from '@/modules/nurturing/lead-service'
import { prisma } from '@/lib/db/client'

const BATCH = 100

export async function POST() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const config = await getIcpConfig(ctx.tenant.id)
  const leads = await prisma.nurtureLead.findMany({
    where: { tenantId: ctx.tenant.id },
    select: { id: true, jobTitle: true, lifecycle: true, company: true, numberOfEmployees: true, annualRevenue: true },
  })

  let updated = 0
  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH)
    await Promise.all(
      batch.map((lead) => {
        const score = config
          ? calcIcpScoreFromRules(config.rules as unknown as IcpRules, lead.jobTitle, lead.lifecycle, lead.numberOfEmployees, lead.annualRevenue)
          : calcIcpScore(lead.jobTitle, lead.lifecycle, lead.company)
        return prisma.nurtureLead.update({
          where: { id: lead.id },
          data: { icpScore: score },
        })
      }),
    )
    updated += batch.length
  }

  return ok({ updated })
}
