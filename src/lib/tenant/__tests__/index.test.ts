import { describe, it, expect } from 'vitest'

// Extracted for testing — matches the implementation in lib/tenant/index.ts
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

describe('toSlug', () => {
  it('lowercases ASCII company names', () => {
    expect(toSlug('Acme Corp')).toBe('acme-corp')
  })

  it('replaces spaces with hyphens', () => {
    expect(toSlug('Foo Bar Baz')).toBe('foo-bar-baz')
  })

  it('strips special characters', () => {
    expect(toSlug('Acme, Inc.')).toBe('acme-inc')
    // "&" is stripped, leaving "a  b" → spaces collapsed → "a-b"
    expect(toSlug('A & B')).toBe('a-b')
  })

  it('trims leading and trailing hyphens', () => {
    expect(toSlug('  Acme  ')).toBe('acme')
  })

  it('replaces underscores with hyphens', () => {
    expect(toSlug('foo_bar')).toBe('foo-bar')
  })

  it('truncates at 48 characters', () => {
    const longName = 'a'.repeat(60)
    expect(toSlug(longName)).toHaveLength(48)
  })

  it('handles Japanese company names (strips non-word chars)', () => {
    // Japanese chars are stripped by [^\w\s-], leaving only ASCII portions
    const result = toSlug('株式会社ACME')
    expect(result).toBe('acme')
  })

  it('handles all-ASCII Japanese romanization', () => {
    expect(toSlug('Markeble AI')).toBe('markeble-ai')
  })

  it('collapses consecutive spaces to single hyphen', () => {
    expect(toSlug('Foo  Bar')).toBe('foo-bar')
  })
})
