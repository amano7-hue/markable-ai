import { prisma } from '@/lib/db/client'
import type { GscClient } from '@/integrations/gsc'
import type { TopOpportunity } from './types'

const UPSERT_BATCH = 20

export async function syncGscData(
  tenantId: string,
  siteUrl: string,
  client: GscClient,
  days = 30,
): Promise<number> {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const rows = await client.searchAnalytics(
    siteUrl,
    startDate.toISOString().slice(0, 10),
    endDate.toISOString().slice(0, 10),
  )

  if (rows.length === 0) return 0

  // Phase 1: upsert all unique keywords in parallel batches
  const uniqueKeywords = [...new Set(rows.map((r) => r.keyword))]
  const keywordMap = new Map<string, string>()

  for (let i = 0; i < uniqueKeywords.length; i += UPSERT_BATCH) {
    const batch = uniqueKeywords.slice(i, i + UPSERT_BATCH)
    const results = await Promise.all(
      batch.map((text) =>
        prisma.seoKeyword.upsert({
          where: { tenantId_text: { tenantId, text } },
          create: { tenantId, text },
          update: {},
          select: { id: true },
        }),
      ),
    )
    batch.forEach((text, idx) => keywordMap.set(text, results[idx].id))
  }

  // Phase 2: upsert all snapshots in parallel batches
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH)
    await Promise.all(
      batch.map((row) => {
        const keywordId = keywordMap.get(row.keyword)!
        const snapshotDate = new Date(row.date)
        const metrics = {
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        }
        return prisma.seoKeywordSnapshot.upsert({
          where: { tenantId_keywordId_snapshotDate: { tenantId, keywordId, snapshotDate } },
          create: { tenantId, keywordId, snapshotDate, ...metrics },
          update: metrics,
        })
      }),
    )
  }

  return rows.length
}

export async function getKeywordHistory(
  tenantId: string,
  keywordId: string,
  days = 30,
) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  return prisma.seoKeywordSnapshot.findMany({
    where: { tenantId, keywordId, snapshotDate: { gte: since } },
    orderBy: { snapshotDate: 'asc' },
  })
}

export async function getTopOpportunities(
  tenantId: string,
): Promise<TopOpportunity[]> {
  // 順位 11〜30 位かつ表示回数が多いキーワードを抽出
  const since = new Date()
  since.setDate(since.getDate() - 7)

  const snapshots = await prisma.seoKeywordSnapshot.findMany({
    where: {
      tenantId,
      snapshotDate: { gte: since },
      position: { gte: 11, lte: 30 },
    },
    include: { keyword: { select: { text: true, isActive: true } } },
    orderBy: { impressions: 'desc' },
    take: 50,
  })

  // キーワードごとに最新1件のみ
  const seen = new Set<string>()
  const result: TopOpportunity[] = []

  for (const snap of snapshots) {
    if (seen.has(snap.keywordId) || !snap.keyword.isActive) continue
    seen.add(snap.keywordId)
    result.push({
      keywordId: snap.keywordId,
      keyword: snap.keyword.text,
      position: snap.position,
      impressions: snap.impressions,
      clicks: snap.clicks,
      ctr: snap.ctr,
      snapshotDate: snap.snapshotDate,
    })
  }

  return result
}
