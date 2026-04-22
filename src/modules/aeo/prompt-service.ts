import { prisma } from '@/lib/db/client'
import type { CreatePromptInput, UpdatePromptInput } from './schemas'
import type { PromptWithStats } from './types'
import type { AeoEngine } from '@/generated/prisma'

export async function listPrompts(tenantId: string): Promise<PromptWithStats[]> {
  const prompts = await prisma.aeoPrompt.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      snapshots: {
        orderBy: { snapshotDate: 'desc' },
        take: 4, // one per engine at most
        select: {
          engine: true,
          ownRank: true,
          snapshotDate: true,
        },
      },
    },
  })

  return prompts.map((p) => {
    const citationsByEngine: Partial<Record<AeoEngine, number | null>> = {}
    let lastSyncedAt: Date | null = null

    for (const snap of p.snapshots) {
      if (!citationsByEngine[snap.engine]) {
        citationsByEngine[snap.engine] = snap.ownRank
        if (!lastSyncedAt || snap.snapshotDate > lastSyncedAt) {
          lastSyncedAt = snap.snapshotDate
        }
      }
    }

    return {
      id: p.id,
      tenantId: p.tenantId,
      text: p.text,
      industry: p.industry,
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      lastSyncedAt,
      citationsByEngine,
    }
  })
}

export async function getPrompt(tenantId: string, promptId: string) {
  return prisma.aeoPrompt.findFirst({
    where: { id: promptId, tenantId },
    include: { competitors: true },
  })
}

export async function createPrompt(
  tenantId: string,
  input: CreatePromptInput,
) {
  const { competitors = [], ...data } = input
  return prisma.aeoPrompt.create({
    data: {
      ...data,
      tenantId,
      competitors: {
        create: competitors.map((domain) => ({ tenantId, domain })),
      },
    },
    include: { competitors: true },
  })
}

export async function updatePrompt(
  tenantId: string,
  promptId: string,
  input: UpdatePromptInput,
) {
  return prisma.aeoPrompt.update({
    where: { id: promptId, tenantId },
    data: input,
  })
}

export async function deletePrompt(tenantId: string, promptId: string) {
  return prisma.aeoPrompt.delete({
    where: { id: promptId, tenantId },
  })
}

export async function addCompetitor(
  tenantId: string,
  promptId: string,
  domain: string,
) {
  return prisma.aeoCompetitor.create({
    data: { tenantId, promptId, domain },
  })
}

export async function removeCompetitor(
  tenantId: string,
  promptId: string,
  domain: string,
) {
  return prisma.aeoCompetitor.deleteMany({
    where: { tenantId, promptId, domain },
  })
}
