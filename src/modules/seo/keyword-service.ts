import { prisma } from '@/lib/db/client'
import type { CreateKeywordInput, UpdateKeywordInput } from './schemas'
import type { KeywordWithStats } from './types'

const PAGE_SIZE = 50

export type KeywordSortKey = 'created' | 'position' | 'impressions'

const SNAPSHOT_SELECT = {
  position: true,
  clicks: true,
  impressions: true,
  ctr: true,
  snapshotDate: true,
} as const

type RawSnapshot = { position: number | null; clicks: number | null; impressions: number | null; ctr: number | null; snapshotDate: Date }

function mapKeyword(k: {
  id: string
  tenantId: string
  text: string
  intent: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  snapshots: RawSnapshot[]
}): KeywordWithStats {
  const latest = k.snapshots[0] ?? null
  const previous = k.snapshots[1] ?? null
  return {
    id: k.id,
    tenantId: k.tenantId,
    text: k.text,
    intent: k.intent,
    isActive: k.isActive,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
    latestPosition: latest?.position ?? null,
    previousPosition: previous?.position ?? null,
    latestClicks: latest?.clicks ?? null,
    latestImpressions: latest?.impressions ?? null,
    latestCtr: latest?.ctr ?? null,
    lastSyncedAt: latest?.snapshotDate ?? null,
  }
}

export async function listKeywords(
  tenantId: string,
  opts: { sort?: KeywordSortKey; page?: number; intent?: string } = {},
): Promise<{ keywords: KeywordWithStats[]; total: number }> {
  const { sort = 'created', page = 1, intent } = opts
  const skip = (page - 1) * PAGE_SIZE

  const where = { tenantId, ...(intent ? { intent } : {}) }
  // Fetch 2 snapshots to compute position trend
  const snapshotInclude = {
    snapshots: {
      orderBy: { snapshotDate: 'desc' as const },
      take: 2,
      select: SNAPSHOT_SELECT,
    },
  }

  // For 'created' sort, push pagination to DB (no need to load all rows)
  if (sort === 'created') {
    const [rawKeywords, total] = await Promise.all([
      prisma.seoKeyword.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
        include: snapshotInclude,
      }),
      prisma.seoKeyword.count({ where }),
    ])
    return { keywords: rawKeywords.map(mapKeyword), total }
  }

  // For position/impressions sort, values come from latest snapshot — must load all rows then sort in memory
  const [rawKeywords, total] = await Promise.all([
    prisma.seoKeyword.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: snapshotInclude,
    }),
    prisma.seoKeyword.count({ where }),
  ])

  const mapped = rawKeywords.map(mapKeyword)
  const sorted = mapped.slice().sort((a, b) => {
    if (sort === 'position') {
      return (a.latestPosition ?? Infinity) - (b.latestPosition ?? Infinity)
    }
    // 'impressions': most impressions first, nulls last
    return (b.latestImpressions ?? -1) - (a.latestImpressions ?? -1)
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
