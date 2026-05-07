import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/client'
import type { User, Tenant, Project } from '@/generated/prisma'

export type AuthContext = {
  clerkId: string
  user: User
  tenant: Tenant
}

export type ProjectAuthContext = {
  clerkId: string
  user: User
  tenant: Tenant
  project: Project
}

/**
 * Server Component / Route Handler から呼ぶ認証ヘルパー。
 * Clerk の userId を元に DB の User と Tenant を返す。
 * 未認証 or DB に存在しない場合は null。
 */
export async function getAuth(): Promise<AuthContext | null> {
  const { userId } = await auth()
  if (!userId) return null

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { tenant: true },
  })

  if (!user) return null

  return {
    clerkId: userId,
    user,
    tenant: user.tenant,
  }
}

/**
 * プロジェクトスコープの認証ヘルパー。
 * - OWNER / ADMIN: テナント内の全プロジェクトにアクセス可
 * - MEMBER: ProjectMember に登録されたプロジェクトのみ
 */
export async function getProjectAuth(projectId: string): Promise<ProjectAuthContext | null> {
  const { userId } = await auth()
  if (!userId) return null

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { tenant: true },
  })
  if (!user) return null

  // プロジェクトがこのテナントに属することを確認
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: user.tenantId },
  })
  if (!project) return null

  // MEMBER はプロジェクトメンバーシップを確認
  if (user.role === 'MEMBER') {
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    })
    if (!membership) return null
  }

  return {
    clerkId: userId,
    user,
    tenant: user.tenant,
    project,
  }
}

/**
 * 認証必須のページ用。未認証なら例外を投げる。
 */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuth()
  if (!ctx) throw new Error('Unauthorized')
  return ctx
}
