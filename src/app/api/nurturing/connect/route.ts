import { z } from 'zod'
import { getAuth, getProjectAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { HubSpotHttpClient } from '@/integrations/hubspot'

// GET: プロジェクトまたはテナントの接続状況を返す
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')

  if (projectId) {
    const ctx = await getProjectAuth(projectId)
    if (!ctx) return err('Unauthorized', 401)
    const connection = await prisma.hubSpotConnection.findUnique({
      where: { projectId },
      select: { portalId: true, updatedAt: true },
    })
    return ok({ connected: !!connection, portalId: connection?.portalId ?? null, updatedAt: connection?.updatedAt ?? null })
  }

  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)
  return ok({ connected: false, portalId: null, updatedAt: null })
}

const ConnectSchema = z.object({
  apiKey: z.string().min(1),
  projectId: z.string().min(1),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = ConnectSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const ctx = await getProjectAuth(parsed.data.projectId)
  if (!ctx) return err('Unauthorized', 401)

  const client = new HubSpotHttpClient(parsed.data.apiKey)
  let portalId: string
  try {
    const result = await client.testConnection()
    portalId = result.portalId
  } catch {
    return err('HubSpot API キーが無効です', 400)
  }

  await prisma.hubSpotConnection.upsert({
    where: { projectId: parsed.data.projectId },
    create: { tenantId: ctx.tenant.id, projectId: parsed.data.projectId, portalId, apiKey: parsed.data.apiKey },
    update: { portalId, apiKey: parsed.data.apiKey },
  })

  return ok({ connected: true, portalId })
}
