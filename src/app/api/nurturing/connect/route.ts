import { z } from 'zod'
import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { HubSpotHttpClient } from '@/integrations/hubspot'

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const connection = await prisma.hubSpotConnection.findUnique({
    where: { tenantId: ctx.tenant.id },
    select: { portalId: true, updatedAt: true },
  })

  return ok({ connected: !!connection, portalId: connection?.portalId ?? null, updatedAt: connection?.updatedAt ?? null })
}

const ConnectSchema = z.object({
  apiKey: z.string().min(1),
})

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = ConnectSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const client = new HubSpotHttpClient(parsed.data.apiKey)
  let portalId: string
  try {
    const result = await client.testConnection()
    portalId = result.portalId
  } catch {
    return err('HubSpot API キーが無効です', 400)
  }

  await prisma.hubSpotConnection.upsert({
    where: { tenantId: ctx.tenant.id },
    create: { tenantId: ctx.tenant.id, portalId, apiKey: parsed.data.apiKey },
    update: { portalId, apiKey: parsed.data.apiKey },
  })

  return ok({ connected: true, portalId })
}
