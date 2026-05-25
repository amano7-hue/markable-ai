import { getProjectAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

const PatchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  ownDomain: z.string().optional(),
  ga4ChannelFilter: z.array(z.string()).optional(),
})

/** OWNER/ADMIN または そのプロジェクトの EDITOR のみ編集・削除可 */
async function isAllowedToManage(ctx: Awaited<ReturnType<typeof getProjectAuth>>, projectId: string): Promise<boolean> {
  if (!ctx) return false
  if (ctx.user.role === 'OWNER' || ctx.user.role === 'ADMIN') return true
  // MEMBER の場合はそのプロジェクトの EDITOR かどうか確認
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: ctx.user.id } },
    select: { role: true },
  })
  return membership?.role === 'EDITOR'
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)
  if (!(await isAllowedToManage(ctx, projectId))) return err('Forbidden', 403)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 400)

  const project = await prisma.project.update({
    where: { id: projectId, tenantId: ctx.tenant.id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.ownDomain !== undefined ? { ownDomain: parsed.data.ownDomain || null } : {}),
      ...(parsed.data.ga4ChannelFilter !== undefined ? { ga4ChannelFilter: parsed.data.ga4ChannelFilter } : {}),
    },
  })

  return ok(project)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)
  if (!(await isAllowedToManage(ctx, projectId))) return err('Forbidden', 403)

  if (ctx.project.isDefault) {
    return err('デフォルトプロジェクトは削除できません', 400)
  }

  await prisma.project.delete({ where: { id: projectId, tenantId: ctx.tenant.id } })
  return ok({ deleted: true })
}
