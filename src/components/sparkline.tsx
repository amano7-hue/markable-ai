interface DataPoint {
  label: string
  value: number
}

interface SparklineProps {
  data: DataPoint[]
  height?: number
  color?: string
  fillOpacity?: number
  showDots?: boolean
  formatValue?: (v: number) => string
}

/**
 * 依存ゼロの SVG スパークライン。
 * アナリティクス・キーワード順位・AEO 追跡などの簡易トレンド表示に使用。
 */
export default function Sparkline({
  data,
  height = 60,
  color = 'hsl(var(--primary))',
  fillOpacity = 0.15,
  showDots = false,
  formatValue,
}: SparklineProps) {
  if (data.length < 2) return null

  const values = data.map((d) => d.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range = maxVal - minVal || 1

  const width = 100 // SVG viewBox width (%)
  const pad = 2

  function x(i: number) {
    return pad + (i / (data.length - 1)) * (width - pad * 2)
  }
  function y(val: number) {
    return pad + ((maxVal - val) / range) * (height - pad * 2)
  }

  const points = data.map((d, i) => `${x(i)},${y(d.value)}`)
  const polyline = points.join(' ')

  // Area path: line → bottom right → bottom left → close
  const areaPath = [
    `M ${points[0]}`,
    ...data.slice(1).map((d, i) => `L ${x(i + 1)},${y(d.value)}`),
    `L ${x(data.length - 1)},${height - pad}`,
    `L ${x(0)},${height - pad}`,
    'Z',
  ].join(' ')

  const lastPoint = data[data.length - 1]
  const firstPoint = data[0]
  const trend = lastPoint.value - firstPoint.value
  const trendColor =
    trend > 0 ? 'text-green-500' : trend < 0 ? 'text-destructive' : 'text-muted-foreground'

  return (
    <div className="space-y-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        style={{ height }}
      >
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={fillOpacity * 2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#sparkGrad)" />
        <polyline
          points={polyline}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {showDots &&
          data.map((d, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(d.value)}
              r="1.5"
              fill={color}
              vectorEffect="non-scaling-stroke"
            />
          ))}
      </svg>
      {/* 最初と最後の値 */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{firstPoint.label}</span>
        <span className={`font-medium ${trendColor}`}>
          {trend > 0 ? '+' : ''}
          {formatValue ? formatValue(trend) : trend.toLocaleString()}
        </span>
        <span>{lastPoint.label}</span>
      </div>
    </div>
  )
}
