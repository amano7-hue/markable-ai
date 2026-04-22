import { prisma } from '@/lib/db/client'
import type { HubSpotClient } from '@/integrations/hubspot'

function calcIcpScore(jobTitle?: string | null, lifecycle?: string | null, company?: string | null): number {
  let score = 0
  const title = (jobTitle ?? '').toLowerCase()

  if (/ceo|cto|cmo|coo|cfo|cso|founder|president/.test(title)) score += 30
  else if (/vp |vice president|director/.test(title)) score += 20
  else if (/manager/.test(title)) score += 10

  if (lifecycle === 'salesqualifiedlead' || lifecycle === 'opportunity') score += 30
  else if (lifecycle === 'marketingqualifiedlead') score += 20

  if (company) score += 10

  return Math.min(score, 100)
}

export async function syncLeads(tenantId: string, client: HubSpotClient): Promise<number> {
  const contacts = await client.getContacts(500)

  for (const c of contacts) {
    const icpScore = calcIcpScore(c.jobTitle, c.lifecycle, c.company)
    await prisma.nurtureLead.upsert({
      where: { tenantId_hubspotId: { tenantId, hubspotId: c.id } },
      create: {
        tenantId,
        hubspotId: c.id,
        email: c.email,
        firstName: c.firstName ?? null,
        lastName: c.lastName ?? null,
        company: c.company ?? null,
        jobTitle: c.jobTitle ?? null,
        lifecycle: c.lifecycle ?? null,
        leadStatus: c.leadStatus ?? null,
        icpScore,
        lastSyncedAt: new Date(),
      },
      update: {
        email: c.email,
        firstName: c.firstName ?? null,
        lastName: c.lastName ?? null,
        company: c.company ?? null,
        jobTitle: c.jobTitle ?? null,
        lifecycle: c.lifecycle ?? null,
        leadStatus: c.leadStatus ?? null,
        icpScore,
        lastSyncedAt: new Date(),
      },
    })
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
