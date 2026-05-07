import { prisma } from '@/lib/db/client'
import { buildDirectLlmoChecker, DirectLlmoChecker } from '@/integrations/llmo-checker'
import { Prisma } from '@/generated/prisma'
import type { CitationGap } from './types'
import type { AeoEngine } from '@/generated/prisma'

const UPSERT_BATCH = 10

const ENGINE_MAP: Record<string, AeoEngine> = {
  chatgpt: 'CHATGPT',
  gemini: 'GEMINI',
  google_ai_overview: 'GOOGLE_AI_OVERVIEW',
}

export async function syncDailySnapshots(
  tenantId: string,
  ownDomain: string | null,
  date: Date,
  checker?: DirectLlmoChecker,
): Promise<void> {
  const prompts = await prisma.aeoPrompt.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, text: true },
  })

  if (prompts.length === 0) return

  const dateStr = date.toISOString().slice(0, 10)
  const resolvedChecker = checker ?? buildDirectLlmoChecker()

  // プロンプトを順番に処理（API レート制限を考慮してシリアル実行）
  for (const prompt of prompts) {
    const results = await resolvedChecker.checkAll(prompt.text, dateStr)

    await prisma.serankingApiLog.create({
      data: {
        tenantId,
        operation: 'direct_llmo_check',
        creditsUsed: 0,
        promptCount: 1,
      },
    }).catch(() => { /* ログ失敗はサイレント */ })

    const validResults = results.flatMap((result) => {
      const dbEngine = ENGINE_MAP[result.engine]
      if (!dbEngine) return []
      const ownEntry = ownDomain
        ? result.citations.find((c) => c.domain === ownDomain)
        : undefined
      return [{ result, dbEngine, ownEntry }]
    })

    for (let i = 0; i < validResults.length; i += UPSERT_BATCH) {
      const batch = validResults.slice(i, i + UPSERT_BATCH)
      await Promise.all(
        batch.map(({ result, dbEngine, ownEntry }) =>
          prisma.aeoRankSnapshot.upsert({
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
          }),
        ),
      )
    }
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
