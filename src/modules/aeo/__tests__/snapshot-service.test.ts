import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  prisma: {
    aeoPrompt: { findMany: vi.fn() },
    aeoRankSnapshot: { upsert: vi.fn(), findMany: vi.fn() },
    tenant: { findUnique: vi.fn() },
  },
}))

import { prisma } from '@/lib/db/client'
import { detectCitationGaps, getSnapshotsForPrompt, syncDailySnapshots } from '../snapshot-service'

const mockPromptFindMany = prisma.aeoPrompt.findMany as ReturnType<typeof vi.fn>
const mockSnapshotUpsert = prisma.aeoRankSnapshot.upsert as ReturnType<typeof vi.fn>
const mockSnapshotFindMany = prisma.aeoRankSnapshot.findMany as ReturnType<typeof vi.fn>
const mockTenantFindUnique = prisma.tenant.findUnique as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── syncDailySnapshots ────────────────────────────────────────────────────────

describe('syncDailySnapshots', () => {
  const date = new Date('2026-04-20')

  function makeClient(results: object[]) {
    return { getPromptResults: vi.fn().mockResolvedValue(results) }
  }

  it('returns early when no active prompts', async () => {
    mockTenantFindUnique.mockResolvedValue({ serankingProjectId: null })
    mockPromptFindMany.mockResolvedValue([])

    const client = makeClient([])
    await syncDailySnapshots('t1', 'example.com', client, date)

    expect(client.getPromptResults).not.toHaveBeenCalled()
    expect(mockSnapshotUpsert).not.toHaveBeenCalled()
  })

  it('calls getPromptResults with correct args', async () => {
    mockTenantFindUnique.mockResolvedValue({ serankingProjectId: 'proj-123' })
    mockPromptFindMany.mockResolvedValue([
      { id: 'p1', serankingPromptId: 'sp1' },
    ])
    const client = makeClient([])
    await syncDailySnapshots('t1', null, client, date)

    expect(client.getPromptResults).toHaveBeenCalledWith(
      'proj-123',
      ['sp1'],
      '2026-04-20',
    )
  })

  it('falls back to mock project id when tenant has no serankingProjectId', async () => {
    mockTenantFindUnique.mockResolvedValue({ serankingProjectId: null })
    mockPromptFindMany.mockResolvedValue([{ id: 'p1', serankingPromptId: null }])
    const client = makeClient([])
    await syncDailySnapshots('t1', null, client, date)

    expect(client.getPromptResults).toHaveBeenCalledWith('mock', ['p1'], '2026-04-20')
  })

  it('uses prompt.id when serankingPromptId is null', async () => {
    mockTenantFindUnique.mockResolvedValue({ serankingProjectId: null })
    mockPromptFindMany.mockResolvedValue([{ id: 'p-db1', serankingPromptId: null }])
    const client = makeClient([])
    await syncDailySnapshots('t1', null, client, date)

    const [, promptIds] = (client.getPromptResults as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(promptIds).toContain('p-db1')
  })

  it('upserts snapshots for each result', async () => {
    mockTenantFindUnique.mockResolvedValue({ serankingProjectId: null })
    mockPromptFindMany.mockResolvedValue([{ id: 'p1', serankingPromptId: 'sp1' }])
    mockSnapshotUpsert.mockResolvedValue({})

    const client = makeClient([
      {
        promptId: 'sp1',
        engine: 'chatgpt',
        snapshotDate: '2026-04-20',
        citations: [{ domain: 'example.com', rank: 1 }],
        rawResponse: null,
      },
    ])

    await syncDailySnapshots('t1', 'mysite.com', client, date)
    expect(mockSnapshotUpsert).toHaveBeenCalledTimes(1)
  })

  it('sets ownRank from citations when ownDomain matches', async () => {
    mockTenantFindUnique.mockResolvedValue({ serankingProjectId: null })
    mockPromptFindMany.mockResolvedValue([{ id: 'p1', serankingPromptId: 'sp1' }])
    mockSnapshotUpsert.mockResolvedValue({})

    const client = makeClient([
      {
        promptId: 'sp1',
        engine: 'chatgpt',
        snapshotDate: '2026-04-20',
        citations: [
          { domain: 'competitor.com', rank: 1 },
          { domain: 'mysite.com', rank: 2 },
        ],
        rawResponse: null,
      },
    ])

    await syncDailySnapshots('t1', 'mysite.com', client, date)
    const upsertCall = mockSnapshotUpsert.mock.calls[0][0]
    expect(upsertCall.create.ownRank).toBe(2)
  })

  it('sets ownRank to null when ownDomain not in citations', async () => {
    mockTenantFindUnique.mockResolvedValue({ serankingProjectId: null })
    mockPromptFindMany.mockResolvedValue([{ id: 'p1', serankingPromptId: 'sp1' }])
    mockSnapshotUpsert.mockResolvedValue({})

    const client = makeClient([
      {
        promptId: 'sp1',
        engine: 'chatgpt',
        snapshotDate: '2026-04-20',
        citations: [{ domain: 'competitor.com', rank: 1 }],
        rawResponse: null,
      },
    ])

    await syncDailySnapshots('t1', 'mysite.com', client, date)
    const upsertCall = mockSnapshotUpsert.mock.calls[0][0]
    expect(upsertCall.create.ownRank).toBeNull()
  })

  it('skips results with unknown engine', async () => {
    mockTenantFindUnique.mockResolvedValue({ serankingProjectId: null })
    mockPromptFindMany.mockResolvedValue([{ id: 'p1', serankingPromptId: 'sp1' }])

    const client = makeClient([
      {
        promptId: 'sp1',
        engine: 'unknown_engine',
        snapshotDate: '2026-04-20',
        citations: [],
        rawResponse: null,
      },
    ])

    await syncDailySnapshots('t1', null, client, date)
    expect(mockSnapshotUpsert).not.toHaveBeenCalled()
  })

  it('maps engine strings to AeoEngine enum values', async () => {
    mockTenantFindUnique.mockResolvedValue({ serankingProjectId: null })
    mockPromptFindMany.mockResolvedValue([{ id: 'p1', serankingPromptId: 'sp1' }])
    mockSnapshotUpsert.mockResolvedValue({})

    const client = makeClient([
      { promptId: 'sp1', engine: 'perplexity', snapshotDate: '2026-04-20', citations: [], rawResponse: null },
    ])

    await syncDailySnapshots('t1', null, client, date)
    const upsertCall = mockSnapshotUpsert.mock.calls[0][0]
    expect(upsertCall.create.engine).toBe('PERPLEXITY')
  })
})

// ─── detectCitationGaps ────────────────────────────────────────────────────────

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
              { domain: 'mycompany.com', rank: 1 },
              { domain: 'competitor.com', rank: 2 },
            ],
          },
        ],
      },
    ])

    const gaps = await detectCitationGaps('tenant-1', 'mycompany.com')
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
    expect(gaps).toHaveLength(2)
    const engines = gaps.map((g) => g.engine)
    expect(engines).toContain('CHATGPT')
    expect(engines).toContain('PERPLEXITY')
    expect(engines).not.toContain('GEMINI')
  })
})

// ─── getSnapshotsForPrompt ─────────────────────────────────────────────────────

describe('getSnapshotsForPrompt', () => {
  it('returns snapshots for the given prompt', async () => {
    const snaps = [
      { id: 's1', tenantId: 't1', promptId: 'p1', engine: 'CHATGPT', snapshotDate: new Date('2026-04-20'), ownRank: 1, citations: [] },
    ]
    mockSnapshotFindMany.mockResolvedValue(snaps)
    const result = await getSnapshotsForPrompt('t1', 'p1')
    expect(result).toEqual(snaps)
  })

  it('returns empty array when no snapshots', async () => {
    mockSnapshotFindMany.mockResolvedValue([])
    const result = await getSnapshotsForPrompt('t1', 'p-missing')
    expect(result).toEqual([])
  })

  it('queries with tenantId and promptId', async () => {
    mockSnapshotFindMany.mockResolvedValue([])
    await getSnapshotsForPrompt('tenant-a', 'prompt-b')
    const args = mockSnapshotFindMany.mock.calls[0][0]
    expect(args.where.tenantId).toBe('tenant-a')
    expect(args.where.promptId).toBe('prompt-b')
  })

  it('filters by snapshotDate within range', async () => {
    mockSnapshotFindMany.mockResolvedValue([])
    await getSnapshotsForPrompt('t1', 'p1')
    const args = mockSnapshotFindMany.mock.calls[0][0]
    expect(args.where.snapshotDate).toBeDefined()
    expect(args.where.snapshotDate.gte).toBeInstanceOf(Date)
  })

  it('orders by snapshotDate asc then engine asc', async () => {
    mockSnapshotFindMany.mockResolvedValue([])
    await getSnapshotsForPrompt('t1', 'p1')
    const args = mockSnapshotFindMany.mock.calls[0][0]
    expect(args.orderBy).toEqual([{ snapshotDate: 'asc' }, { engine: 'asc' }])
  })
})
