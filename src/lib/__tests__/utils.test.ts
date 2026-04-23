import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('cn', () => {
  it('returns single class unchanged', () => {
    expect(cn('text-sm')).toBe('text-sm')
  })

  it('merges multiple classes', () => {
    expect(cn('text-sm', 'font-bold')).toBe('text-sm font-bold')
  })

  it('deduplicates conflicting Tailwind classes (last wins)', () => {
    expect(cn('text-sm', 'text-lg')).toBe('text-lg')
  })

  it('filters out falsy values', () => {
    expect(cn('text-sm', false, null, undefined, '')).toBe('text-sm')
  })

  it('handles conditional objects', () => {
    expect(cn('base', { 'text-red-500': true, 'text-green-500': false })).toBe('base text-red-500')
  })

  it('merges conflicting padding classes (last wins)', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8')
  })

  it('handles arrays of classes', () => {
    expect(cn(['text-sm', 'font-bold'])).toBe('text-sm font-bold')
  })

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('')
  })
})
