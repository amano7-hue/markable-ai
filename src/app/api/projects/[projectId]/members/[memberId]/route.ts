import { getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { ok, err } from '@/lib/api-response'

/** DELETE /api/projects/[projectId]/members/[memberId] — メンバー削除 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; memberId: string }> },
) {
  const { projectId, memberId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)
  if (ctx.user.role === 'MEMBER') return err('Forbidden', 403)

  const member = await prisma.projectMember.findFirst({
    where: { id: memberId, projectId },
  })
  if (!member) return err('メンバーが見つかりません', 404)

  await prisma.projectMember.delete({ where: { id: memberId } })
  return ok({ deleted: true })
}
