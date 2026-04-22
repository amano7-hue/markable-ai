import { z } from 'zod'
import type { AeoEngine } from '@/generated/prisma'

export interface PromptWithStats {
  id: string
  tenantId: string
  text: string
  industry: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  lastSyncedAt: Date | null
  citationsByEngine: Partial<Record<AeoEngine, number | null>>
}

export interface CitationGap {
  promptId: string
  promptText: string
  engine: AeoEngine
  competitorDomain: string
  competitorRank: number
  snapshotDate: Date
}

export const AeoSuggestionPayloadSchema = z.object({
  promptId: z.string(),
  promptText: z.string(),
  gaps: z.array(
    z.object({
      engine: z.string(),
      competitorDomain: z.string(),
      competitorRank: z.number(),
    }),
  ),
  suggestion: z.string(),
  generatedAt: z.string(),
})

export type AeoSuggestionPayload = z.infer<typeof AeoSuggestionPayloadSchema>

export function parseAeoSuggestionPayload(payload: unknown): AeoSuggestionPayload {
  return AeoSuggestionPayloadSchema.parse(payload)
}
