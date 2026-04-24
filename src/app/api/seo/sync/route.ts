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

  try {
    const client = await getGscClient(connection)
    const siteUrl = connection?.siteUrl || 'mock'
    const count = await syncGscData(ctx.tenant.id, siteUrl, client, 30)
    return ok({ synced: count }, 202)
  } catch (e) {
    console.error('[seo/sync] syncGscData failed:', e)
    return err('GSC 同期に失敗しました', 500)
  }
}
