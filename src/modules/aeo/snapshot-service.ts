import { prisma } from '@/lib/db/client'
import type { SerankingClient } from '@/integrations/seranking'
import { Prisma } from '@/generated/prisma'
import type { CitationGap } from './types'
import type { AeoEngine } from '@/generated/prisma'

const ENGINE_MAP: Record<string, AeoEngine> = {
  chatgpt: 'CHATGPT',
  perplexity: 'PERPLEXITY',
  gemini: 'GEMINI',
  google_ai_overview: 'GOOGLE_AI_OVERVIEW',
}

export async function syncDailySnapshots(
  tenantId: string,
  ownDomain: string | null,
  client: SerankingClient,
  date: Date,
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { serankingProjectId: true },
  })

  const prompts = await prisma.aeoPrompt.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, serankingPromptId: true },
  })

  if (prompts.length === 0) return

  const dateStr = date.toISOString().slice(0, 10)
  const promptIds = prompts
    .map((p) => p.serankingPromptId ?? p.id)

  // TODO: Seranking leaderboard は 7,500 credits/req と高額。
  //       AeoLeaderboardCache を実装後、キャッシュ確認を必須にすること。
  const results = await client.getPromptResults(
    tenant?.serankingProjectId ?? 'mock',
    promptIds,
    dateStr,
  )

  for (const result of results) {
    const dbEngine = ENGINE_MAP[result.engine]
    if (!dbEngine) continue

    const prompt = prompts.find(
      (p) => (p.serankingPromptId ?? p.id) === result.promptId,
    )
    if (!prompt) continue

    const ownEntry = ownDomain
      ? result.citations.find((c) => c.domain === ownDomain)
      : undefined

    await prisma.aeoRankSnapshot.upsert({
      where: {
        tenantId_promptId_engine_snapshotDate: {
          tenantId,
          promptId: prompt.id,
          engine: dbEngine,
          snapshotDate: new Date(result.snapshotDate),
        },
      },
      create: {
        tenantId,
        promptId: prompt.id,
        engine: dbEngine,
        snapshotDate: new Date(result.snapshotDate),
        ownDomain: ownDomain ?? null,
        ownRank: ownEntry?.rank ?? null,
        citations: result.citations as object[],
        rawResponse: result.rawResponse
          ? ({ text: result.rawResponse } as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      update: {
        ownRank: ownEntry?.rank ?? null,
        citations: result.citations as object[],
      },
    })
  }
}

export async function getSnapshotsForPrompt(
  tenantId: string,
  promptId: string,
  days = 30,
) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  return prisma.aeoRankSnapshot.findMany({
    where: {
      tenantId,
      promptId,
      snapshotDate: { gte: since },
    },
    orderBy: [{ snapshotDate: 'asc' }, { engine: 'asc' }],
  })
}

export async function detectCitationGaps(
  tenantId: string,
  ownDomain: string | null,
): Promise<CitationGap[]> {
  if (!ownDomain) return []

  // 直近スナップショット（エンジン×プロンプトの最新1件ずつ）
  const prompts = await prisma.aeoPrompt.findMany({
    where: { tenantId, isActive: true },
    select: {
      id: true,
      text: true,
      snapshots: {
        orderBy: { snapshotDate: 'desc' },
        take: 4,
        select: {
          engine: true,
          snapshotDate: true,
          ownRank: true,
          citations: true,
        },
      },
    },
  })

  const gaps: CitationGap[] = []

  for (const prompt of prompts) {
    for (const snap of prompt.snapshots) {
      // 自社が引用されていない場合のみ
      if (snap.ownRank !== null) continue

      const citations = snap.citations as Array<{ domain: string; rank: number }>
      for (const citation of citations) {
        if (citation.domain === ownDomain) continue
        gaps.push({
          promptId: prompt.id,
          promptText: prompt.text,
          engine: snap.engine,
          competitorDomain: citation.domain,
          competitorRank: citation.rank,
          snapshotDate: snap.snapshotDate,
        })
      }
    }
  }

  return gaps
}
