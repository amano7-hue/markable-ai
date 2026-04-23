import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

const PatchSchema = z.object({
  siteUrl: z.string().min(1),
})

export async function PATCH(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '有効なサイト URL を入力してください' }, { status: 400 })
  }

  const connection = await prisma.gscConnection.findUnique({
    where: { tenantId: ctx.tenant.id },
  })
  if (!connection) {
    return NextResponse.json({ error: 'GSC が接続されていません' }, { status: 404 })
  }

  const updated = await prisma.gscConnection.update({
    where: { tenantId: ctx.tenant.id },
    data: { siteUrl: parsed.data.siteUrl },
    select: { siteUrl: true },
  })

  return NextResponse.json(updated)
}
