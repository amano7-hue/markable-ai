import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  ownDomain: z.string().optional(),
  serankingProjectId: z.string().optional(),
})

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenant.id },
    select: { id: true, name: true, slug: true, ownDomain: true, serankingProjectId: true },
  })

  return NextResponse.json(tenant)
}

export async function PATCH(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, ownDomain, serankingProjectId } = parsed.data

  const tenant = await prisma.tenant.update({
    where: { id: ctx.tenant.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(ownDomain !== undefined ? { ownDomain: ownDomain || null } : {}),
      ...(serankingProjectId !== undefined
        ? { serankingProjectId: serankingProjectId || null }
        : {}),
    },
    select: { id: true, name: true, slug: true, ownDomain: true, serankingProjectId: true },
  })

  return NextResponse.json(tenant)
}
