import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { getSerankingClient } from '@/integrations/seranking'

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  if (!process.env.SERANKING_API_KEY) {
    return err('SERANKING_API_KEY が設定されていません', 400)
  }

  try {
    const client = getSerankingClient()
    const projects = await client.listProjects()
    return ok(projects)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return err(`Seranking API エラー: ${msg}`, 500)
  }
}
