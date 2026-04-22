import { prisma } from '@/lib/db/client'
import type { GscClient } from '@/integrations/gsc'
import type { TopOpportunity } from './types'

export async function syncGscData(
  tenantId: string,
  siteUrl: string,
  client: GscClient,
  days = 30,
): Promise<void> {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const rows = await client.searchAnalytics(
    siteUrl,
    startDate.toISOString().slice(0, 10),
    endDate.toISOString().slice(0, 10),
  )

  // キーワード → DB の id マップ（upsert）
  const keywordMap = new Map<string, string>()

  for (const row of rows) {
    if (!keywordMap.has(row.keyword)) {
      const kw = await prisma.seoKeyword.upsert({
        where: { tenantId_text: { tenantId, text: row.keyword } },
        create: { tenantId, text: row.keyword },
        update: {},
        select: { id: true },
      })
      keywordMap.set(row.keyword, kw.id)
    }

    const keywordId = keywordMap.get(row.keyword)!

    await prisma.seoKeywordSnapshot.upsert({
      where: {
        tenantId_keywordId_snapshotDate: {
          tenantId,
          keywordId,
          snapshotDate: new Date(row.date),
        },
      },
      create: {
        tenantId,
        keywordId,
        snapshotDate: new Date(row.date),
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      },
      update: {
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      },
    })
  }
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
