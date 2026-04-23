import { z } from 'zod'
import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'

const PatchSchema = z.object({ propertyId: z.string().min(1) })

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const conn = await prisma.ga4Connection.findUnique({
    where: { tenantId: ctx.tenant.id },
    select: { email: true, propertyId: true, updatedAt: true },
  })

  return ok({ connected: !!conn, connection: conn })
}

export async function PATCH(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const conn = await prisma.ga4Connection.findUnique({
    where: { tenantId: ctx.tenant.id },
  })
  if (!conn) return err('Not connected', 400)

  await prisma.ga4Connection.update({
    where: { tenantId: ctx.tenant.id },
    data: { propertyId: parsed.data.propertyId },
  })

  return ok({ updated: true })
}
