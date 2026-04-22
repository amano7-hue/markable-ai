import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/client'
import type { User, Tenant } from '@/generated/prisma'

export type AuthContext = {
  clerkId: string
  user: User
  tenant: Tenant
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
 * 認証必須のページ用。未認証なら例外を投げる。
 */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuth()
  if (!ctx) throw new Error('Unauthorized')
  return ctx
}
