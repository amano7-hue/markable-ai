import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/client'
import { ok, err } from '@/lib/api-response'

/**
 * POST /api/invite/[token]/accept
 *
 * 招待トークンを受け入れる。
 * - 既存テナントユーザー: ProjectMember に追加するだけ
 * - 新規ユーザー (DB に User レコードなし): テナントに MEMBER として参加 + ProjectMember 追加
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const { userId: clerkId } = await auth()
  if (!clerkId) return err('Unauthorized', 401)

  // トークン検証
  const invite = await prisma.projectInvite.findUnique({
    where: { token },
    include: { project: true, tenant: true },
  })
  if (!invite) return err('招待が見つかりません', 404)
  if (invite.acceptedAt) return err('この招待は既に使用されています')
  if (invite.expiresAt < new Date()) return err('招待の有効期限が切れています')

  // Clerk ユーザー情報取得
  const clerkUser = await currentUser()
  if (!clerkUser) return err('Unauthorized', 401)

  const userEmail = clerkUser.emailAddresses[0]?.emailAddress ?? ''

  // DB の User レコードを確認
  let user = await prisma.user.findUnique({ where: { clerkId } })

  if (!user) {
    // 新規ユーザー: テナントに MEMBER として参加
    user = await prisma.user.create({
      data: {
        clerkId,
        email: userEmail,
        name: clerkUser.fullName ?? undefined,
        tenantId: invite.tenantId,
        role: 'MEMBER',
      },
    })
  } else if (user.tenantId !== invite.tenantId) {
    // 別テナントに属するユーザーは受け入れ不可
    return err('このアカウントは別のワークスペースに属しています', 409)
  }

  // 既にメンバーなら何もしない
  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: invite.projectId, userId: user.id } },
  })

  if (!existing) {
    await prisma.projectMember.create({
      data: { projectId: invite.projectId, userId: user.id, role: invite.role },
    })
  }

  // 招待を使用済みにマーク
  await prisma.projectInvite.update({
    where: { token },
    data: { acceptedAt: new Date() },
  })

  return ok({
    projectId: invite.projectId,
    projectSlug: invite.project.slug,
  })
}
