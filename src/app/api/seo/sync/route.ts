import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { syncGscData } from '@/modules/seo'
import { getGscClient } from '@/integrations/gsc'
import { prisma } from '@/lib/db/client'

export async function POST() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const connection = await prisma.gscConnection.findUnique({
    where: { tenantId: ctx.tenant.id },
  })

  const client = await getGscClient(connection)
  const siteUrl = connection?.siteUrl || 'mock'

  await syncGscData(ctx.tenant.id, siteUrl, client, 30)

  return ok({ synced: true }, 202)
}
