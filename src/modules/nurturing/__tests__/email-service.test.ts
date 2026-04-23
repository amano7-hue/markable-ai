import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockMessagesCreate } = vi.hoisted(() => ({
  mockMessagesCreate: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockMessagesCreate }
  },
}))

vi.mock('@/lib/db/client', () => ({
  prisma: {
    nurtureSegment: { findFirst: vi.fn() },
    nurtureEmailDraft: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    approvalItem: { create: vi.fn() },
  },
}))

import { prisma } from '@/lib/db/client'
import { parseEmailDraftOutput, generateEmailDraft, listDrafts, getDraft } from '../email-service'

const mockSegmentFindFirst = prisma.nurtureSegment.findFirst as ReturnType<typeof vi.fn>
const mockDraftCreate = prisma.nurtureEmailDraft.create as ReturnType<typeof vi.fn>
const mockDraftFindMany = prisma.nurtureEmailDraft.findMany as ReturnType<typeof vi.fn>
const mockDraftFindFirst = prisma.nurtureEmailDraft.findFirst as ReturnType<typeof vi.fn>
const mockApprovalCreate = prisma.approvalItem.create as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── parseEmailDraftOutput (pure function) ────────────────────────────────────

describe('parseEmailDraftOutput', () => {
  it('extracts subject and body from well-formed LLM output', () => {
    const raw = `件名: 【無料トライアル】マーケティング自動化ツールのご紹介
---
いつもお世話になっております。

Markeble AI の山田でございます。
御社のマーケティング効率化に向けて、ぜひ一度ご提案させてください。`

    const result = parseEmailDraftOutput(raw, 'fallback subject')
    expect(result.subject).toBe('【無料トライアル】マーケティング自動化ツールのご紹介')
    expect(result.body).toContain('いつもお世話になっております。')
    expect(result.body).not.toContain('件名:')
    expect(result.body).not.toContain('---')
  })

  it('falls back to provided subject when 件名: line is missing', () => {
    const raw = `---
本文だけのメールです。`

    const result = parseEmailDraftOutput(raw, '商談化促進 - MQLセグメント')
    expect(result.subject).toBe('商談化促進 - MQLセグメント')
    expect(result.body).toBe('本文だけのメールです。')
  })

  it('returns full rawText as body when no separator found', () => {
    const raw = `件名: テスト件名
本文がセパレーターなし`

    const result = parseEmailDraftOutput(raw, 'fallback')
    expect(result.subject).toBe('テスト件名')
    // no --- means whole rawText is body
    expect(result.body).toBe(raw.trim())
  })

  it('handles empty rawText gracefully', () => {
    const result = parseEmailDraftOutput('', 'default subject')
    expect(result.subject).toBe('default subject')
    expect(result.body).toBe('')
  })

  it('trims whitespace from subject', () => {
    const raw = `件名:   スペースあり件名
---
本文`
    const result = parseEmailDraftOutput(raw, 'fallback')
    expect(result.subject).toBe('スペースあり件名')
  })

  it('trims leading/trailing whitespace from body', () => {
    const raw = `件名: 件名
---

  本文内容

`
    const result = parseEmailDraftOutput(raw, 'fallback')
    expect(result.body).toBe('本文内容')
  })
})

// ─── generateEmailDraft ───────────────────────────────────────────────────────

describe('generateEmailDraft', () => {
  function makeSegment(overrides = {}) {
    return {
      id: 'seg1',
      tenantId: 't1',
      name: 'MQL セグメント',
      description: null,
      leads: [],
      ...overrides,
    }
  }

  beforeEach(() => {
    mockDraftCreate.mockResolvedValue({ id: 'draft-1' })
    mockApprovalCreate.mockResolvedValue({ id: 'approval-1' })
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '件名: テスト件名\n---\n本文テスト' }],
    })
  })

  it('throws when segment not found', async () => {
    mockSegmentFindFirst.mockResolvedValue(null)
    await expect(generateEmailDraft('t1', { segmentId: 'missing', goal: '初回接触' })).rejects.toThrow(
      'Segment not found',
    )
    expect(mockDraftCreate).not.toHaveBeenCalled()
  })

  it('returns draftId', async () => {
    mockSegmentFindFirst.mockResolvedValue(makeSegment())
    const result = await generateEmailDraft('t1', { segmentId: 'seg1', goal: '初回接触' })
    expect(result.draftId).toBe('draft-1')
  })

  it('creates draft with tenantId and segmentId', async () => {
    mockSegmentFindFirst.mockResolvedValue(makeSegment())
    await generateEmailDraft('t1', { segmentId: 'seg1', goal: '初回接触' })
    expect(mockDraftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't1',
          segmentId: 'seg1',
        }),
      }),
    )
  })

  it('creates approval item with module=nurturing and type=nurturing_email_draft', async () => {
    mockSegmentFindFirst.mockResolvedValue(makeSegment())
    await generateEmailDraft('t1', { segmentId: 'seg1', goal: '初回接触' })
    expect(mockApprovalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't1',
          module: 'nurturing',
          type: 'nurturing_email_draft',
        }),
      }),
    )
  })

  it('queries segment with tenantId for security', async () => {
    mockSegmentFindFirst.mockResolvedValue(null)
    await generateEmailDraft('t1', { segmentId: 'seg1', goal: '初回接触' }).catch(() => {})
    expect(mockSegmentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'seg1', tenantId: 't1' } }),
    )
  })

  it('stores empty string when LLM returns non-text block', async () => {
    mockSegmentFindFirst.mockResolvedValue(makeSegment())
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 'tu1', name: 'fn', input: {} }],
    })
    await generateEmailDraft('t1', { segmentId: 'seg1', goal: '初回接触' })
    const draftData = mockDraftCreate.mock.calls[0][0].data
    // parseEmailDraftOutput('', ...) → body: '', subject: fallback
    expect(draftData.body).toBe('')
  })
})

// ─── listDrafts ───────────────────────────────────────────────────────────────

describe('listDrafts', () => {
  it('queries without status filter when not provided', async () => {
    mockDraftFindMany.mockResolvedValue([])
    await listDrafts('t1')
    expect(mockDraftFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1' } }),
    )
  })

  it('includes status filter when provided', async () => {
    mockDraftFindMany.mockResolvedValue([])
    await listDrafts('t1', 'PENDING')
    expect(mockDraftFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1', status: 'PENDING' } }),
    )
  })
})

// ─── getDraft ─────────────────────────────────────────────────────────────────

describe('getDraft', () => {
  it('queries with id and tenantId', async () => {
    mockDraftFindFirst.mockResolvedValue(null)
    await getDraft('t1', 'draft-99')
    expect(mockDraftFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'draft-99', tenantId: 't1' } }),
    )
  })
})
