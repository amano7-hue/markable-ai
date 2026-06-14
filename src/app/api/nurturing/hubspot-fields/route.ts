import { ok, err } from '@/lib/api-response'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { getHubSpotClient } from '@/integrations/hubspot'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return err('projectId が必要です', 400)

  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)

  const conn = await prisma.hubSpotConnection.findUnique({
    where: { projectId },
    select: { apiKey: true },
  })
  if (!conn?.apiKey) return err('HubSpot が接続されていません', 404)

  const client = getHubSpotClient({ apiKey: conn.apiKey })

  try {
    const [contacts, deals] = await Promise.all([
      client.getProperties('contacts'),
      client.getProperties('deals'),
    ])
    return ok({ contacts, deals })
  } catch (e) {
    console.error('[hubspot-fields] getProperties failed:', e)
    return err('HubSpot プロパティの取得に失敗しました', 500)
  }
}
