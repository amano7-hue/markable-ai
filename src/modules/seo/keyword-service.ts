import { prisma } from '@/lib/db/client'
import type { CreateKeywordInput, UpdateKeywordInput } from './schemas'
import type { KeywordWithStats } from './types'

export async function listKeywords(tenantId: string): Promise<KeywordWithStats[]> {
  const keywords = await prisma.seoKeyword.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      snapshots: {
        orderBy: { snapshotDate: 'desc' },
        take: 1,
        select: {
          position: true,
          clicks: true,
          impressions: true,
          ctr: true,
          snapshotDate: true,
        },
      },
    },
  })

  return keywords.map((k) => {
    const latest = k.snapshots[0] ?? null
    return {
      id: k.id,
      tenantId: k.tenantId,
      text: k.text,
      intent: k.intent,
      isActive: k.isActive,
      createdAt: k.createdAt,
      updatedAt: k.updatedAt,
      latestPosition: latest?.position ?? null,
      latestClicks: latest?.clicks ?? null,
      latestImpressions: latest?.impressions ?? null,
      latestCtr: latest?.ctr ?? null,
      lastSyncedAt: latest?.snapshotDate ?? null,
    }
  })
}

export async function getKeyword(tenantId: string, keywordId: string) {
  return prisma.seoKeyword.findFirst({
    where: { id: keywordId, tenantId },
  })
}

export async function createKeyword(tenantId: string, input: CreateKeywordInput) {
  return prisma.seoKeyword.create({
    data: { ...input, tenantId },
  })
}

export async function updateKeyword(
  tenantId: string,
  keywordId: string,
  input: UpdateKeywordInput,
) {
  return prisma.seoKeyword.update({
    where: { id: keywordId, tenantId },
    data: input,
  })
}

export async function deleteKeyword(tenantId: string, keywordId: string) {
  return prisma.seoKeyword.delete({
    where: { id: keywordId, tenantId },
  })
}
