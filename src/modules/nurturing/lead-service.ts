import { prisma } from '@/lib/db/client'
import type { HubSpotClient } from '@/integrations/hubspot'

export function calcIcpScore(jobTitle?: string | null, lifecycle?: string | null, company?: string | null): number {
  let score = 0
  const title = (jobTitle ?? '').toLowerCase()

  if (/\b(ceo|cto|cmo|coo|cfo|cso|founder|president)\b/.test(title)) score += 30
  else if (/vp |vice president|director/.test(title)) score += 20
  else if (/manager/.test(title)) score += 10

  if (lifecycle === 'salesqualifiedlead' || lifecycle === 'opportunity') score += 30
  else if (lifecycle === 'marketingqualifiedlead') score += 20

  if (company) score += 10

  return Math.min(score, 100)
}

const UPSERT_BATCH = 20

export async function syncLeads(tenantId: string, client: HubSpotClient): Promise<number> {
  const contacts = await client.getContacts(500)
  const now = new Date()

  // Process in concurrent batches to avoid overwhelming the DB connection pool
  for (let i = 0; i < contacts.length; i += UPSERT_BATCH) {
    const batch = contacts.slice(i, i + UPSERT_BATCH)
    await Promise.all(
      batch.map((c) => {
        const icpScore = calcIcpScore(c.jobTitle, c.lifecycle, c.company)
        const fields = {
          email: c.email,
          firstName: c.firstName ?? null,
          lastName: c.lastName ?? null,
          company: c.company ?? null,
          jobTitle: c.jobTitle ?? null,
          lifecycle: c.lifecycle ?? null,
          leadStatus: c.leadStatus ?? null,
          icpScore,
          lastSyncedAt: now,
        }
        return prisma.nurtureLead.upsert({
          where: { tenantId_hubspotId: { tenantId, hubspotId: c.id } },
          create: { tenantId, hubspotId: c.id, ...fields },
          update: fields,
        })
      }),
    )
  }

  return contacts.length
}

export async function listLeads(tenantId: string, lifecycle?: string) {
  return prisma.nurtureLead.findMany({
    where: {
      tenantId,
      ...(lifecycle ? { lifecycle } : {}),
    },
    orderBy: { icpScore: 'desc' },
  })
}
