import { z } from 'zod'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { syncLeads } from '@/modules/nurturing'
import { getHubSpotClient } from '@/integrations/hubspot'
import type { HubSpotImportFilter } from '@/integrations/hubspot'
import { prisma } from '@/lib/db/client'

const SyncSchema = z.object({ projectId: z.string().min(1) })

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = SyncSchema.safeParse(body)
  if (!parsed.success) return err('projectId が必要です')

  const ctx = await getProjectAuth(parsed.data.projectId)
  if (!ctx) return err('Unauthorized', 401)

  const connection = await prisma.hubSpotConnection.findUnique({
    where: { projectId: parsed.data.projectId },
  })

  try {
    const client = getHubSpotClient(connection ? { ...connection, importFilter: connection.importFilter as HubSpotImportFilter | null | undefined } : null)
    const count = await syncLeads(ctx.tenant.id, parsed.data.projectId, client)
    return ok({ synced: count }, 202)
  } catch (e) {
    console.error('[nurturing/sync] syncLeads failed:', e)
    return err('HubSpot 同期に失敗しました', 500)
  }
}
