import { getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { ok, err } from '@/lib/api-response'
import type { ProjectRole } from '@/generated/prisma'

/** GET /api/projects/[projectId]/invites — メンバー一覧 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)
  if (ctx.user.role === 'MEMBER') return err('Forbidden', 403)

  const [members, pendingInvites] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.projectInvite.findMany({
      where: { projectId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return ok({ members, pendingInvites })
}

/** POST /api/projects/[projectId]/invites — 招待リンク生成 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)
  if (ctx.user.role === 'MEMBER') return err('Forbidden', 403)

  const body = await req.json()
  const role: ProjectRole = body.role === 'EDITOR' ? 'EDITOR' : 'VIEWER'

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7日

  const invite = await prisma.projectInvite.create({
    data: { projectId, tenantId: ctx.tenant.id, role, expiresAt },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const inviteUrl = `${appUrl}/invite/${invite.token}`

  return ok({ inviteUrl, token: invite.token, role, expiresAt })
}

/** DELETE /api/projects/[projectId]/invites/[token] — 招待取り消し */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)
  if (ctx.user.role === 'MEMBER') return err('Forbidden', 403)

  const body = await req.json()
  const { token } = body

  await prisma.projectInvite.deleteMany({
    where: { token, projectId },
  })

  return ok({ deleted: true })
}
