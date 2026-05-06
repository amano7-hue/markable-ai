import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { getIcpConfig } from '@/modules/nurturing/icp-config-service'

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const config = await getIcpConfig(ctx.tenant.id)
  return ok({ config })
}
