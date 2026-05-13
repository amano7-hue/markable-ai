import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

const patchSchema = z.object({
  mermaidCode: z.string().optional(),
  title: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ articleId: string; diagramId: string }> },
) {
  const ctx = await getAuth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { articleId, diagramId } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const diagram = await prisma.seoArticleDiagram.findFirst({
    where: { id: diagramId, tenantId: ctx.tenant.id, articleId },
  })
  if (!diagram) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.seoArticleDiagram.update({
    where: { id: diagramId, tenantId: ctx.tenant.id },
    data: parsed.data,
  })

  return NextResponse.json(updated)
}
