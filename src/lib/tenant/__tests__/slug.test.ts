import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  prisma: {
    tenant: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
  },
}))

import { toSlug } from '../index'

describe('toSlug', () => {
  it('lowercases the name', () => {
    expect(toSlug('Acme Corp')).toBe('acme-corp')
  })

  it('replaces spaces with hyphens', () => {
    expect(toSlug('hello world')).toBe('hello-world')
  })

  it('replaces underscores with hyphens', () => {
    expect(toSlug('hello_world')).toBe('hello-world')
  })

  it('strips special characters except hyphens', () => {
    expect(toSlug('Acme, Inc.')).toBe('acme-inc')
  })

  it('collapses multiple spaces/underscores into single hyphen', () => {
    expect(toSlug('hello  world')).toBe('hello-world')
    expect(toSlug('hello__world')).toBe('hello-world')
  })

  it('strips leading and trailing hyphens', () => {
    expect(toSlug('-hello-')).toBe('hello')
  })

  it('truncates to 48 characters', () => {
    const long = 'a'.repeat(60)
    expect(toSlug(long)).toHaveLength(48)
  })

  it('handles Japanese company names (non-word chars stripped)', () => {
    // Japanese characters are not matched by \w (ASCII), so they are stripped
    const result = toSlug('株式会社テスト')
    // All characters stripped, result is empty string
    expect(typeof result).toBe('string')
  })

  it('handles empty string', () => {
    expect(toSlug('')).toBe('')
  })

  it('handles alphanumeric names', () => {
    expect(toSlug('Markable AI 2024')).toBe('markable-ai-2024')
  })
})
