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
  try {
    const { token } = await params
    const { userId: clerkId } = await auth()
    if (!clerkId) return err('ログインが必要です', 401)

    // トークン検証
    const invite = await prisma.projectInvite.findUnique({
      where: { token },
      include: {
        project: { select: { id: true, name: true, slug: true, ownDomain: true } },
        tenant: { select: { id: true, name: true } },
      },
    })
    if (!invite) return err('招待が見つかりません', 404)
    if (invite.acceptedAt) return err('この招待は既に使用されています', 400)
    if (invite.expiresAt < new Date()) return err('招待の有効期限が切れています', 400)

    // Clerk ユーザー情報取得（失敗してもメール・名前なしで続行）
    let userEmail = ''
    let userName: string | undefined
    try {
      const clerkUser = await currentUser()
      userEmail = clerkUser?.emailAddresses[0]?.emailAddress ?? ''
      userName = clerkUser?.fullName ?? undefined
    } catch {
      // Clerk API が一時的に不安定でも招待受け入れは続行
    }

    // DB の User レコードを確認
    let user = await prisma.user.findUnique({ where: { clerkId } })

    if (!user) {
      // 新規ユーザー: テナントに MEMBER として参加
      user = await prisma.user.create({
        data: {
          clerkId,
          email: userEmail,
          name: userName,
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
  } catch (e) {
    console.error('[invite/accept] unexpected error:', e instanceof Error ? e.message : String(e))
    return err('招待の受け入れ中にエラーが発生しました', 500)
  }
}
