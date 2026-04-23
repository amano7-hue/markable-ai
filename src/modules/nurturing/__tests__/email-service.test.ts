import { describe, it, expect } from 'vitest'
import { parseEmailDraftOutput } from '../email-service'

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
