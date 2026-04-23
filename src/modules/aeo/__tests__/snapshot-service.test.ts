import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  prisma: {
    aeoPrompt: { findMany: vi.fn() },
    aeoRankSnapshot: { upsert: vi.fn() },
    tenant: { findUnique: vi.fn() },
  },
}))

import { prisma } from '@/lib/db/client'
import { detectCitationGaps } from '../snapshot-service'

const mockPromptFindMany = prisma.aeoPrompt.findMany as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('detectCitationGaps', () => {
  it('returns empty array when ownDomain is null', async () => {
    const gaps = await detectCitationGaps('tenant-1', null)
    expect(gaps).toEqual([])
    expect(mockPromptFindMany).not.toHaveBeenCalled()
  })

  it('returns empty array when all prompts have no snapshots', async () => {
    mockPromptFindMany.mockResolvedValue([
      { id: 'p1', text: 'What is the best CRM?', snapshots: [] },
    ])

    const gaps = await detectCitationGaps('tenant-1', 'example.com')
    expect(gaps).toEqual([])
  })

  it('skips snapshots where own domain is already cited', async () => {
    mockPromptFindMany.mockResolvedValue([
      {
        id: 'p1',
        text: 'Best SaaS tools?',
        snapshots: [
          {
            engine: 'CHATGPT',
            snapshotDate: new Date('2026-04-01'),
            ownRank: 2, // already cited
            citations: [
              { domain: 'example.com', rank: 2 },
              { domain: 'competitor.com', rank: 1 },
            ],
          },
        ],
      },
    ])

    const gaps = await detectCitationGaps('tenant-1', 'example.com')
    expect(gaps).toEqual([])
  })

  it('detects gaps when own domain is not cited', async () => {
    const snapshotDate = new Date('2026-04-01')
    mockPromptFindMany.mockResolvedValue([
      {
        id: 'p1',
        text: 'Best marketing automation?',
        snapshots: [
          {
            engine: 'CHATGPT',
            snapshotDate,
            ownRank: null, // NOT cited
            citations: [
              { domain: 'competitor-a.com', rank: 1 },
              { domain: 'competitor-b.com', rank: 2 },
            ],
          },
        ],
      },
    ])

    const gaps = await detectCitationGaps('tenant-1', 'mycompany.com')
    expect(gaps).toHaveLength(2)
    expect(gaps[0]).toMatchObject({
      promptId: 'p1',
      promptText: 'Best marketing automation?',
      engine: 'CHATGPT',
      competitorDomain: 'competitor-a.com',
      competitorRank: 1,
      snapshotDate,
    })
    expect(gaps[1].competitorDomain).toBe('competitor-b.com')
  })

  it('excludes own domain from gap citations', async () => {
    mockPromptFindMany.mockResolvedValue([
      {
        id: 'p1',
        text: 'Best CRM?',
        snapshots: [
          {
            engine: 'PERPLEXITY',
            snapshotDate: new Date('2026-04-01'),
            ownRank: null,
            citations: [
              { domain: 'mycompany.com', rank: 1 }, // own domain in citations
              { domain: 'competitor.com', rank: 2 },
            ],
          },
        ],
      },
    ])

    const gaps = await detectCitationGaps('tenant-1', 'mycompany.com')
    // own domain should not appear in gaps
    expect(gaps).toHaveLength(1)
    expect(gaps[0].competitorDomain).toBe('competitor.com')
  })

  it('handles multiple prompts and engines', async () => {
    mockPromptFindMany.mockResolvedValue([
      {
        id: 'p1',
        text: 'Prompt A',
        snapshots: [
          {
            engine: 'CHATGPT',
            snapshotDate: new Date(),
            ownRank: null,
            citations: [{ domain: 'comp1.com', rank: 1 }],
          },
          {
            engine: 'GEMINI',
            snapshotDate: new Date(),
            ownRank: 1, // cited on Gemini
            citations: [{ domain: 'comp2.com', rank: 2 }],
          },
        ],
      },
      {
        id: 'p2',
        text: 'Prompt B',
        snapshots: [
          {
            engine: 'PERPLEXITY',
            snapshotDate: new Date(),
            ownRank: null,
            citations: [{ domain: 'comp3.com', rank: 1 }],
          },
        ],
      },
    ])

    const gaps = await detectCitationGaps('tenant-1', 'mysite.com')
    // p1/CHATGPT (1 gap) + p1/GEMINI (cited, skip) + p2/PERPLEXITY (1 gap)
    expect(gaps).toHaveLength(2)
    const engines = gaps.map((g) => g.engine)
    expect(engines).toContain('CHATGPT')
    expect(engines).toContain('PERPLEXITY')
    expect(engines).not.toContain('GEMINI')
  })
})
