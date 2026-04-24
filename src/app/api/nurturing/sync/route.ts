import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { syncLeads } from '@/modules/nurturing'
import { getHubSpotClient } from '@/integrations/hubspot'
import { prisma } from '@/lib/db/client'

export async function POST() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const connection = await prisma.hubSpotConnection.findUnique({
    where: { tenantId: ctx.tenant.id },
  })

  try {
    const client = getHubSpotClient(connection)
    const count = await syncLeads(ctx.tenant.id, client)
    return ok({ synced: count }, 202)
  } catch (e) {
    console.error('[nurturing/sync] syncLeads failed:', e)
    return err('HubSpot 同期に失敗しました', 500)
  }
}
