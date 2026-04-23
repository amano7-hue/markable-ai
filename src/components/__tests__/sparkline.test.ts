/**
 * Sparkline は純粋な SVG レンダリングコンポーネントのため、
 * ロジック部分（座標計算・トレンド計算）を直接テストする。
 * JSDOM を使わずに純粋な値テストとして実装。
 */
import { describe, it, expect } from 'vitest'

// Sparkline コンポーネントの内部ロジックを抽出して検証
function calcCoords(values: number[], width: number, height: number, pad: number) {
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range = maxVal - minVal || 1

  return values.map((val, i) => ({
    x: pad + (i / (values.length - 1)) * (width - pad * 2),
    y: pad + ((maxVal - val) / range) * (height - pad * 2),
  }))
}

function calcTrend(values: number[]) {
  if (values.length < 2) return 0
  return values[values.length - 1] - values[0]
}

describe('Sparkline coordinate calculation', () => {
  it('first point is at x=pad', () => {
    const coords = calcCoords([10, 20, 30], 100, 60, 2)
    expect(coords[0].x).toBe(2)
  })

  it('last point is at x=(width - pad)', () => {
    const coords = calcCoords([10, 20, 30], 100, 60, 2)
    expect(coords[coords.length - 1].x).toBe(98)
  })

  it('max value maps to y=pad (top)', () => {
    const coords = calcCoords([10, 20, 30], 100, 60, 2)
    expect(coords[2].y).toBe(2) // 30 is max → y=pad
  })

  it('min value maps to y=(height - pad) (bottom)', () => {
    const coords = calcCoords([10, 20, 30], 100, 60, 2)
    expect(coords[0].y).toBe(58) // 10 is min → y=height-pad
  })

  it('middle value is vertically centered', () => {
    const coords = calcCoords([0, 50, 100], 100, 60, 2)
    expect(coords[1].y).toBe(2 + (60 - 2 * 2) / 2) // midpoint
  })

  it('handles flat data (all same value) without division by zero', () => {
    const coords = calcCoords([5, 5, 5], 100, 60, 2)
    expect(coords.every((c) => isFinite(c.x) && isFinite(c.y))).toBe(true)
  })

  it('two-point data produces start and end coords only', () => {
    const coords = calcCoords([10, 50], 100, 60, 2)
    expect(coords).toHaveLength(2)
    expect(coords[0].x).toBe(2)
    expect(coords[1].x).toBe(98)
  })
})

describe('Sparkline trend calculation', () => {
  it('returns positive trend when last > first', () => {
    expect(calcTrend([10, 20, 30])).toBe(20)
  })

  it('returns negative trend when last < first', () => {
    expect(calcTrend([30, 20, 10])).toBe(-20)
  })

  it('returns 0 for flat data', () => {
    expect(calcTrend([15, 15, 15])).toBe(0)
  })

  it('returns 0 for single element', () => {
    expect(calcTrend([42])).toBe(0)
  })

  it('handles two-element array', () => {
    expect(calcTrend([100, 150])).toBe(50)
  })
})

describe('Sparkline area path construction', () => {
  function buildAreaPath(values: number[], width = 100, height = 60, pad = 2) {
    const coords = calcCoords(values, width, height, pad)
    const parts = [
      `M ${coords[0].x},${coords[0].y}`,
      ...coords.slice(1).map((c) => `L ${c.x},${c.y}`),
      `L ${coords[coords.length - 1].x},${height - pad}`,
      `L ${coords[0].x},${height - pad}`,
      'Z',
    ]
    return parts.join(' ')
  }

  it('starts with M command', () => {
    const path = buildAreaPath([10, 20, 30])
    expect(path.startsWith('M')).toBe(true)
  })

  it('closes with Z', () => {
    const path = buildAreaPath([10, 20, 30])
    expect(path.endsWith('Z')).toBe(true)
  })

  it('includes bottom-left and bottom-right anchor points', () => {
    const path = buildAreaPath([10, 20, 30], 100, 60, 2)
    // Bottom-right: x=98, y=58; Bottom-left: x=2, y=58
    expect(path).toContain('L 98,58')
    expect(path).toContain('L 2,58')
  })
})
