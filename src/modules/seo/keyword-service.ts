import { prisma } from '@/lib/db/client'
import type { CreateKeywordInput, UpdateKeywordInput } from './schemas'
import type { KeywordWithStats } from './types'

const PAGE_SIZE = 50

export type KeywordSortKey = 'created' | 'position' | 'impressions'

export async function listKeywords(
  tenantId: string,
  opts: { sort?: KeywordSortKey; page?: number; intent?: string } = {},
): Promise<{ keywords: KeywordWithStats[]; total: number }> {
  const { sort = 'created', page = 1, intent } = opts
  const skip = (page - 1) * PAGE_SIZE

  const where = { tenantId, ...(intent ? { intent } : {}) }

  const [rawKeywords, total] = await Promise.all([
    prisma.seoKeyword.findMany({
      where,
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
    }),
    prisma.seoKeyword.count({ where }),
  ])

  const mapped: KeywordWithStats[] = rawKeywords.map((k) => {
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

  // Sort in memory (position/impressions need latest snapshot values)
  const sorted = mapped.slice().sort((a, b) => {
    if (sort === 'position') {
      const pa = a.latestPosition ?? Infinity
      const pb = b.latestPosition ?? Infinity
      return pa - pb
    }
    if (sort === 'impressions') {
      const ia = a.latestImpressions ?? -1
      const ib = b.latestImpressions ?? -1
      return ib - ia
    }
    // 'created': newest first
    return b.createdAt.getTime() - a.createdAt.getTime()
  })

  return { keywords: sorted.slice(skip, skip + PAGE_SIZE), total }
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
